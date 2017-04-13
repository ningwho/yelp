const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'keyboard cat',
  cookie: {
    maxAge: 60000
  }
}));

// Make session automatically available to all hbs files
app.use(function(request, response, next) {
  response.locals.session = request.session;
  next();
});

app.get('/', function(request, response) {
  response.render('frontpage.hbs');
});

app.get('/ask', function(request, response) {
  response.render('ask.hbs');
});

app.post('/submit_name', function(request, response) {
  request.session.guest_name = request.body.your_name;
  response.redirect('/');
});

app.listen(3000, function() {
  console.log('Listening or port 3000.');
});
