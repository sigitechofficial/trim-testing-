const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });
// Defining the account for sending email
exports.transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true, // use TLS
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

 