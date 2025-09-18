const express = require('express');
const router = express.Router();
const User = require('../models/user');

// GET signup
router.get('/signup', (req, res) => {
  res.render('auth/signup', { error: null, email: '' });
});

// POST signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).render('auth/signup', { error: 'Email already in use', email });
    }
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ email, passwordHash });
    req.session.userId = user._id.toString();
    res.redirect('/');
  } catch (err) {
    res.status(400).render('auth/signup', { error: 'Could not create account', email: req.body.email || '' });
  }
});

// GET login
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null, email: '' });
});

// POST login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).render('auth/login', { error: 'Invalid credentials', email });
    }
    const ok = await user.verifyPassword(password);
    if (!ok) {
      return res.status(400).render('auth/login', { error: 'Invalid credentials', email });
    }
    req.session.userId = user._id.toString();
    res.redirect('/');
  } catch (err) {
    res.status(400).render('auth/login', { error: 'Login failed', email: req.body.email || '' });
  }
});

// POST logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;




