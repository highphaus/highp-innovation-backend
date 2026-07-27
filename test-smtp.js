require('dotenv').config();
const nodemailer = require('nodemailer');
const dns = require('dns');

const dnsLookupIPv4 = (hostname, options, callback) => {
  return dns.lookup(hostname, { family: 4 }, callback);
};

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  lookup: dnsLookupIPv4,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

console.log(`Testing SMTP connection for: ${process.env.SMTP_USER}`);
console.log(`Password loaded: ${process.env.SMTP_PASS ? '✅ Present' : '❌ Missing'}`);

transporter.verify((err, success) => {
  if (err) {
    console.error('\n❌ SMTP Connection FAILED:');
    console.error(err.message);
  } else {
    console.log('\n✅ SMTP Connection SUCCESS — credentials are valid!');
    console.log('Sending a test email...');

    transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER,
      subject: '✅ HighP SMTP Test — Working!',
      text: 'This is a test email from your HighP backend. OTP delivery is now working.',
      html: '<h2 style="color:#D03D56">✅ HighP SMTP is working!</h2><p>OTP emails will now be delivered successfully.</p>'
    }, (mailErr, info) => {
      if (mailErr) {
        console.error('❌ Send failed:', mailErr.message);
      } else {
        console.log('✅ Test email sent! Message ID:', info.messageId);
        console.log('Check highphaus@gmail.com inbox.');
      }
      process.exit(0);
    });
  }
});
