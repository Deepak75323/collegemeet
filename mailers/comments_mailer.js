const nodeMailer = require("../config/nodemailer");
const env = require("../config/environment");

exports.newComment = async function (comment) {
  try {
    let htmlString = await nodeMailer.renderTemplate(
      { comment: comment },
      "/comments/new_comment.ejs"
    );

    await nodeMailer.transporter.sendMail({
      from: env.smtp.auth.user,
      to: comment.user.email,
      subject: "New Comment",
      html: htmlString,
    });
  } catch (err) {
    console.log("error in sending mail:", err);
  }
};
