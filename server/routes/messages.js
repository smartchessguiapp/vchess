const path = require('path')
let router = require("express").Router();
const access = require("../utils/access");
const sendEmail = require(__dirname.replace(`${path.sep}routes`, `${path.sep}utils${path.sep}mailer`));
const params = require(__dirname.replace(`${path.sep}routes`, `${path.sep}config${path.sep}parameters`));

// Send a message through contact form
router.post("/messages", access.ajax, (req,res) => {
  const from = req.body["email"];
  // Replace potential newline characters in subject
  const subject = req.body["subject"].replace(/\r?\n|\r/g, " ");
  const body = req.body["content"];

  sendEmail(from, params.mail.contact, subject, body, err => {
    res.json(err || {});
  });
});

module.exports = router;
