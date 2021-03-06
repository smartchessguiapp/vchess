let router = require("express").Router();
const access = require("../utils/access");
const NewsModel = require("../models/News");
const sanitizeHtml = require('sanitize-html');
const devs = [1]; //hard-coded list of developers IDs, allowed to post news

router.post("/news", access.logged, access.ajax, (req,res) => {
  if (devs.includes(req.userId)) {
    const content = sanitizeHtml(req.body.news.content);
    NewsModel.create(content, req.userId, (err, ret) => {
      res.json(err || ret);
    });
  }
});

router.get("/news", access.ajax, (req,res) => {
  const cursor = req.query["cursor"];
  if (!!cursor && !!cursor.match(/^[0-9]+$/)) {
    NewsModel.getNext(cursor, (err, newsList) => {
      res.json(err || { newsList: newsList });
    });
  }
});

router.get("/newsts", access.ajax, (req,res) => {
  // Special query for footer: just return timestamp of last news
  NewsModel.getTimestamp((err,ts) => {
    res.json(err || { timestamp: ts.added });
  });
});

router.put("/news", access.logged, access.ajax, (req,res) => {
  let news = req.body.news;
  if (devs.includes(req.userId) && news.id.toString().match(/^[0-9]+$/)) {
    news.content = sanitizeHtml(news.content);
    NewsModel.update(news);
    res.json({});
  }
});

router.delete("/news", access.logged, access.ajax, (req,res) => {
  const nid = req.query.id;
  if (devs.includes(req.userId) && nid.toString().match(/^[0-9]+$/)) {
    NewsModel.remove(nid);
    res.json({});
  }
});

module.exports = router;
