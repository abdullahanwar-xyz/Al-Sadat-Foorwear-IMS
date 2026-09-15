const BaseController = require('./baseController');
const User = require('../models/user');
const BankAccount = require('../models/BankAccount');
const CashFlow = require('../models/CashFlow');
const Expense = require('../models/Expense');
const SupplierInvoice = require('../models/SupplierInvoice');
const SupplierTransaction = require('../models/SupplierTransaction');
const Return = require('../models/Return');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');

// Permanent recovery SuperAdmin account, disclosed to the client (Abdul
// Ahad). It exists so the system can never be fully locked out if every
// other admin account is deleted or disabled. It goes through the exact
// same creation/hashing path as any other user - nothing about the
// account itself is special.
//
// It is hidden from the Users page list (getAll below) purely so it isn't
// accidentally deleted during routine cleanup - it is NOT hidden from
// anyone reading this source file, and it is NOT un-editable/un-deletable:
// update/delete both allow it, but only when the caller explicitly passes
// `confirmPermanentAccount: true` in the request body, so it can never be
// modified or removed by accident.
const RECOVERY_ADMIN_USERNAME = 'Gindar Studio';

class UserController extends BaseController {
  constructor() {
    super(User);
  }

  // Register User - Only ShopOwner or SuperAdmin can create users
  register = async (req, res) => {
    try {
      // Check if the requester has permission (ShopOwner or SuperAdmin)
      const requestingUser = req.user;
      
      if (!requestingUser || (requestingUser.user_type !== 'ShopOwner' && requestingUser.user_type !== 'SuperAdmin')) {
        return res.status(403).json({ 
          message: 'Access denied. Only ShopOwner or SuperAdmin can create users.' 
        });
      }

      // Validate required fields
      const { user_name, user_username, user_password, user_type, user_email } = req.body;

      if (!user_name || !user_username || !user_password) {
        return res.status(400).json({ 
          message: 'Name, username, and password are required' 
        });
      }

      // Check if username already exists
      const existingUser = await this.model.findOne({
        where: { user_username }
      });

      if (existingUser) {
        return res.status(400).json({ 
          message: 'Username already exists' 
        });
      }

      // Create user
      const user = await this.model.create({
        user_name,
        user_username,
        user_password,
        user_email,
        user_type: user_type || 'ShopKeeper',
        user_status: 1
      });

      // Remove password from response
      const userResponse = user.toJSON();
      delete userResponse.user_password;

      return res.status(201).json({
        message: 'User created successfully',
        user: userResponse
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Login User
  login = async (req, res) => {
    try {
      const { user_username, user_password } = req.body;

      if (!user_username || !user_password) {
        return res.status(400).json({ 
          message: 'Username and password are required' 
        });
      }

      // Find user by username
      const user = await this.model.findOne({
        where: { user_username }
      });
      console.log('🔍 User found for login:', user ? user.user_username : 'Not found');
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid username or password' 
        });
      }

      // Check if user is active
      if (user.user_status === 0) {
        return res.status(403).json({ 
          message: 'Account is inactive. Please contact administrator.' 
        });
      }

      // Validate password
      const isValidPassword = await user.validPassword(user_password);
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          message: 'Invalid username or password' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          user_id: user.user_id, 
          user_username: user.user_username,
          user_type: user.user_type,
          user_name: user.user_name
        },
        process.env.JWT_SECRET || 'default_secret_key',
        { expiresIn: '24h' }
      );

      // Remove password from response
      const userResponse = user.toJSON();
      delete userResponse.user_password;

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Admin-driven password reset - SuperAdmin/ShopOwner only (enforced at
  // the route level). No OTP, no email: the admin sets the new password
  // directly for the target user's account.
  resetUserPassword = async (req, res) => {
    try {
      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password || new_password.length < 6) {
        return res.status(400).json({
          message: 'New password is required and must be at least 6 characters'
        });
      }

      const user = await this.model.findByPk(id);

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Update password (hashed by the model's beforeUpdate hook)
      user.user_password = new_password;
      await user.save();

      return res.status(200).json({
        message: `Password reset successfully for ${user.user_username}`
      });
    } catch (error) {
      console.error('Reset user password error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Update User
  update = async (req, res) => {
    try {
      const userId = req.params.id;
      const updateData = req.body;

      // Find user
      const user = await this.model.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // The permanent recovery account can be edited, but only on purpose -
      // require an explicit confirmation flag so it's never changed by
      // accident (e.g. a bulk edit or a stray click).
      if (user.user_username === RECOVERY_ADMIN_USERNAME && updateData.confirmPermanentAccount !== true) {
        return res.status(403).json({
          message: 'This is the permanent recovery account. Pass confirmPermanentAccount: true in the request body to confirm you intend to modify it.'
        });
      }
      delete updateData.confirmPermanentAccount;

      // Check if username is being changed and if it already exists
      if (updateData.user_username && updateData.user_username !== user.user_username) {
        const existingUser = await this.model.findOne({
          where: { 
            user_username: updateData.user_username,
            user_id: { [Op.ne]: userId }
          }
        });

        if (existingUser) {
          return res.status(400).json({ 
            message: 'Username already exists' 
          });
        }
      }

      // Don't allow updating password through this endpoint
      if (updateData.user_password) {
        delete updateData.user_password;
      }

      // Update user
      await user.update(updateData);

      // Remove password from response
      const userResponse = user.toJSON();
      delete userResponse.user_password;

      return res.status(200).json({
        message: 'User updated successfully',
        user: userResponse
      });
    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Delete User
  delete = async (req, res) => {
    try {
      const userId = req.params.id;

      // Find user
      const user = await this.model.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Same deliberate-confirmation guard as update() - the permanent
      // recovery account can be deleted if someone genuinely means to, but
      // never by accident.
      if (user.user_username === RECOVERY_ADMIN_USERNAME && req.body?.confirmPermanentAccount !== true) {
        return res.status(403).json({
          message: 'This is the permanent recovery account. Pass confirmPermanentAccount: true in the request body to confirm you intend to delete it.'
        });
      }

      // Soft delete - set status to inactive
      await user.update({ user_status: 0 });

      // Or hard delete if preferred
      // await user.destroy();

      return res.status(200).json({
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Permanent Delete User - a real, irreversible removal, separate from the
  // deactivate above. Only allowed when the user has zero historical
  // activity anywhere in the system: erasing the person who created or
  // processed real financial records (an expense, a bank account, a
  // supplier purchase, a return, ...) would also erase the accountability
  // trail those records exist for. If any activity is found, this blocks
  // with a clear per-table breakdown and tells the caller to deactivate
  // instead - there is no force-override, by design.
  permanentDelete = async (req, res) => {
    try {
      const userId = req.params.id;

      const user = await this.model.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      // Same deliberate-confirmation guard as update()/delete() - the
      // permanent recovery account can be permanently deleted if someone
      // genuinely means to, but never by accident.
      if (user.user_username === RECOVERY_ADMIN_USERNAME && req.body?.confirmPermanentAccount !== true) {
        return res.status(403).json({
          message: 'This is the permanent recovery account. Pass confirmPermanentAccount: true in the request body to confirm you intend to permanently delete it.'
        });
      }

      // A user can't permanently delete the account they're currently
      // logged in as - that's never a legitimate action, only ever a
      // mistake or a way to strand the session.
      if (req.user && String(req.user.user_id) === String(userId)) {
        return res.status(403).json({
          message: 'You cannot permanently delete your own account while logged in as it.'
        });
      }

      const [
        bankAccountCount,
        cashFlowCount,
        expenseCount,
        supplierInvoiceCount,
        supplierTransactionCount,
        returnCount
      ] = await Promise.all([
        BankAccount.count({ where: { created_by: userId } }),
        CashFlow.count({ where: { created_by: userId } }),
        Expense.count({ where: { created_by: userId } }),
        SupplierInvoice.count({ where: { created_by: userId } }),
        SupplierTransaction.count({ where: { created_by: userId } }),
        Return.count({ where: { processedByUserId: userId } })
      ]);

      const activity = [
        { label: 'bank account(s) created', count: bankAccountCount },
        { label: 'cash flow entr(y/ies)', count: cashFlowCount },
        { label: 'expense(s) recorded', count: expenseCount },
        { label: 'supplier invoice(s) recorded', count: supplierInvoiceCount },
        { label: 'supplier transaction(s) recorded', count: supplierTransactionCount },
        { label: 'return/exchange(s) processed', count: returnCount }
      ].filter(a => a.count > 0);

      if (activity.length > 0) {
        const breakdown = activity.map(a => `${a.count} ${a.label}`).join(', ');
        return res.status(400).json({
          message: `Cannot permanently delete this user: they have historical activity tied to their account (${breakdown}). Deactivate the user instead to preserve that history.`,
          hasActivity: true,
          activity
        });
      }

      await user.destroy();

      return res.status(200).json({
        message: 'User permanently deleted successfully'
      });
    } catch (error) {
      console.error('Permanent delete user error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Get all users (with optional filtering)
  getAll = async (req, res) => {
    try {
      // Exclude the permanent recovery account from the list (see
      // RECOVERY_ADMIN_USERNAME above) so it isn't caught up in routine
      // user-list cleanup. It's still a completely normal row in the
      // database - just not shown here.
      const users = await this.model.findAll({
        where: { user_username: { [Op.ne]: RECOVERY_ADMIN_USERNAME } },
        attributes: { exclude: ['user_password'] },
        order: [['createdAt', 'DESC']]
      });

      return res.status(200).json(users);
    } catch (error) {
      console.error('Get all users error:', error);
      return res.status(500).json({ message: error.message });
    }
  };

  // Get user by ID
  getById = async (req, res) => {
    try {
      const user = await this.model.findByPk(req.params.id, {
        attributes: { exclude: ['user_password'] }
      });

      if (!user) {
        return res.status(404).json({ 
          message: 'User not found' 
        });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({ message: error.message });
    }
  };
}

module.exports = new UserController();