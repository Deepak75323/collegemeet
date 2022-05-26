const commentsMailer = require("../mailers/comments_mailer");



const emailQueueProcessor=(job,done)=>
{
    try
    {
        console.log(job.data.comment);
        commentsMailer.newComment(job.data.comment);
        done();

    }
    catch(err)
    {
        done(err);
        console.log("error in emailQueueProcessor",err);
    }
}




module.exports = emailQueueProcessor;