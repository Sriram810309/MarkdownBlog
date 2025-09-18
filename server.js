const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const Article = require('./models/article');
const User = require('./models/user');
const authRouter = require('./routes/auth');
const Comment = require('./models/comment');

const app = express();

app.use(methodOverride('_method'));

// ✅ Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/blog')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));

// ✅ Sessions (Mongo-backed)
app.use(
  session({
    secret: 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/blog' }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

// ✅ Expose current user to views
app.use(async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).lean();
      res.locals.currentUser = user ? { _id: user._id, email: user.email } : null;
    } else {
      res.locals.currentUser = null;
    }
  } catch (err) {
    res.locals.currentUser = null;
  }
  next();
});

// ✅ Auth guard
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

// ✅ Auth routes
app.use('/auth', authRouter);

// ✅ Main landing page
app.get('/', (req, res) => {
  res.render('home');
});

// ✅ Articles list (protected)
app.get('/articles', requireAuth, async (req, res) => {
  try {
    const articles = await Article.find().sort({ createdAt: 'desc' });
    res.render('articles/index', { articles });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

//
// ------------------ Article Routes ------------------
//

// New article form (protected)
app.get('/articles/new', requireAuth, (req, res) => {
  res.render('articles/new', { article: new Article() });
});

// Edit article form (protected + ownership)
app.get('/articles/edit/:id', requireAuth, async (req, res) => {
  const cleanId = req.params.id.trim();

  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return res.redirect('/');
  }

  const article = await Article.findById(cleanId);
  if (!article) return res.redirect('/');
  // Ownership check
  if (article.author && String(article.author) !== String(req.session.userId)) {
    return res.redirect('/articles');
  }
  res.render('articles/edit', { article });
});

// Show article by slug
app.get('/articles/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) return res.redirect('/');
    const comments = await Comment.find({ article: article._id })
      .populate('author', 'email')
      .lean();
    res.render('articles/show', { article, comments });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Create article (protected)
app.post(
  '/articles',
  requireAuth,
  async (req, res, next) => {
    try {
      req.article = new Article();
      next();
    } catch (err) {
      console.error("❌ Error creating article:", err);
      res.redirect('/articles/new'); // redirect back to form if error occurs
    }
  },
  saveArticleAndRedirect('new')
);


// Update article (protected)
app.put(
  '/articles/:id',
  requireAuth,
  async (req, res, next) => {
    const cleanId = req.params.id.trim();

    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.redirect('/');
    }

    req.article = await Article.findById(cleanId);
    if (!req.article) return res.redirect('/');
    if (req.article.author && String(req.article.author) !== String(req.session.userId)) {
      return res.redirect('/articles');
    }
    next();
  },
  saveArticleAndRedirect('edit')
);

// Delete article (protected)
app.delete('/articles/:id', requireAuth, async (req, res) => {
  try {
    const cleanId = req.params.id.trim();

    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.redirect('/');
    }

    const article = await Article.findById(cleanId);
    if (!article) return res.redirect('/articles');
    if (article.author && String(article.author) !== String(req.session.userId)) {
      return res.redirect('/articles');
    }
    await Article.findByIdAndDelete(cleanId);
    res.redirect('/articles');
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// ✅ Helper function
function saveArticleAndRedirect(path) {
  return async (req, res) => {
    let article = req.article;
    article.title = req.body.title;
    article.description = req.body.description;
    article.markdown = req.body.markdown;
    if (!article.author && req.session && req.session.userId) {
      article.author = req.session.userId;
    }

    try {
      article = await article.save();
      res.redirect(`/articles/${article.slug}`);
    } catch (e) {
      res.render(`articles/${path}`, { article });
    }
  };
}

// Profile: list current user's posts
app.get('/profile', requireAuth, async (req, res) => {
  try {
    const articles = await Article.find({ author: req.session.userId }).sort({ createdAt: 'desc' });
    res.render('profile', { articles });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Create comment
app.post('/articles/:slug/comments', requireAuth, async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) return res.redirect('/');
    await Comment.create({
      article: article._id,
      author: req.session.userId,
      content: req.body.content,
      parent: req.body.parentId || null
    });
    res.redirect(`/articles/${article.slug}#comments`);
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

//
// ---------------------------------------------------
//

app.listen(5000, () => {
  console.log('🚀 Server is running on http://localhost:5000');
});
