const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Article = require('./../models/article');

// New article form
router.get('/new', (req, res) => {
  res.render('articles/new', { article: new Article() });
});

// Edit article form
router.get('/edit/:id', async (req, res) => {
  const cleanId = req.params.id.trim();

  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return res.redirect('/');
  }

  const article = await Article.findById(cleanId);
  if (!article) return res.redirect('/');
  res.render('articles/edit', { article });
});

// Show article by slug
router.get('/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) return res.redirect('/');
    res.render('articles/show', { article });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Create article
router.post(
  '/',
  async (req, res, next) => {
    req.article = new Article();
    next();
  },
  saveArticleAndRedirect('new')
);

// ✅ Update article
router.put(
  '/:id',
  async (req, res, next) => {
    const cleanId = req.params.id.trim();

    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.redirect('/');
    }

    req.article = await Article.findById(cleanId);
    if (!req.article) return res.redirect('/');
    next();
  },
  saveArticleAndRedirect('edit')
);

// ✅ Delete article
router.delete('/:id', async (req, res) => {
  try {
    const cleanId = req.params.id.trim();

    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.redirect('/');
    }

    await Article.findByIdAndDelete(cleanId);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

// Helper
function saveArticleAndRedirect(path) {
  return async (req, res) => {
    let article = req.article;
    article.title = req.body.title;
    article.description = req.body.description;
    article.markdown = req.body.markdown;

    try {
      article = await article.save();
      res.redirect(`/articles/${article.slug}`);
    } catch (e) {
      res.render(`articles/${path}`, { article });
    }
  };
}

module.exports = router;
