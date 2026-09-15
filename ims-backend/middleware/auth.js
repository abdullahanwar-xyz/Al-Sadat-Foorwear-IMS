const jwt = require("jsonwebtoken");
const User = require("../models/user");

const isAdminAuthenticated = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Extract token (expecting "Bearer <token>")
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if admin exists
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach admin to request object
    req.admin = {
      id: user.user_id,
      username: user.user_username,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    console.error("Authentication error:", error);
    res.status(500).json({ message: "Server authentication error" });
  }
};

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key', (err, user) => {
      if (err) {
        return res.status(403).json({ 
          message: 'Invalid or expired token.' 
        });
      }

      // Attach user info to request
      req.user = user;
      next();
    });
  } catch (error) {
    return res.status(500).json({ 
      message: 'Authentication error',
      error: error.message 
    });
  }
};

// Middleware to authorize specific roles
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          message: 'Authentication required.' 
        });
      }

      if (!allowedRoles.includes(req.user.user_type)) {
        return res.status(403).json({ 
          message: 'Access denied. Insufficient permissions.' 
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({ 
        message: 'Authorization error',
        error: error.message 
      });
    }
  };
};

module.exports = { 
  isAdminAuthenticated,
  authenticateToken,
  authorizeRoles
};
