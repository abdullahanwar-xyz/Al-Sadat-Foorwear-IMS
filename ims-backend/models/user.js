const { DataTypes } = require("sequelize");
const crypto = require("crypto"); // Only used to verify legacy SHA-1 hashes during migration
const bcrypt = require("bcrypt");
const { sequelize } = require("../config/db");

const BCRYPT_ROUNDS = 10;

// A bcrypt hash always starts with $2a$/$2b$/$2y$ followed by the cost and
// a fixed-length salt+hash - a legacy SHA-1 hex digest never starts with
// "$", so this is a safe, cheap way to tell the two formats apart without
// a separate "hash algorithm" column.
function isBcryptHash(value) {
  return typeof value === "string" && value.startsWith("$2");
}

const userModel = sequelize.define(
  "user",
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    user_username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    user_password: {
      type: DataTypes.STRING(255),
      allowNull: true, // Allow null values
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
    user_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "ShopKeeper",
      validate: {
        isIn: [
          [
            "SuperAdmin",
            "ShopOwner",
            "Contentuser",
            "ShopKeeper",
          ],
        ],
      },
    },
    user_status: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "users",
    timestamps: true,
    hooks: {
      // Every write path that sets a plaintext password (register, admin
      // reset, profile update) goes through here, so this hook can always
      // assume it's given plaintext and hash it with bcrypt. The one
      // exception - the transparent SHA-1-to-bcrypt migration in
      // validPassword below - writes an already-hashed value directly via
      // update({ hooks: false }) specifically to avoid double-hashing here.
      beforeCreate: async (user) => {
        if (user.user_password) {
          user.user_password = await bcrypt.hash(user.user_password, BCRYPT_ROUNDS);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("user_password") && user.user_password) {
          user.user_password = await bcrypt.hash(user.user_password, BCRYPT_ROUNDS);
        }
      },
    },
  }
);

// Validates a login attempt against whichever hash format this user's
// account currently has, transparently migrating legacy accounts to bcrypt
// along the way:
// - bcrypt hash (new accounts, or any account already migrated) -> a
//   normal bcrypt compare, nothing else to do.
// - legacy SHA-1 hash (every account created before this migration) -> a
//   SHA-1 compare (the only thing possible - SHA-1 can't be reversed into
//   a bcrypt hash without the plaintext). On a successful match, the
//   plaintext is right here in the request, so re-hash it with bcrypt and
//   persist it immediately - the account is fully migrated from that login
//   on, with zero disruption and no forced reset. update({ hooks: false })
//   is deliberate: beforeUpdate would otherwise re-hash this already-hashed
//   value as if it were plaintext, corrupting it.
userModel.prototype.validPassword = async function (password) {
  if (isBcryptHash(this.user_password)) {
    return bcrypt.compare(password, this.user_password);
  }

  const legacyHash = crypto.createHash("sha1").update(password).digest("hex");
  if (this.user_password !== legacyHash) {
    return false;
  }

  const migratedHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await this.update({ user_password: migratedHash }, { hooks: false });
  return true;
};


module.exports = userModel;
