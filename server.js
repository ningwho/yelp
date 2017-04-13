const express = require('express');
const Promise = require('bluebird');
const session = require('express-session');
const bcrypt = require('bcrypt');
const pgp = require('pg-promise')({
  promiseLib: Promise
});
const bodyParser = require('body-parser');
const app = express();
const fs = require('fs');
app.use(express.static('public'));

app.use(session({
  secret: 'hello',
  cookie: {
    maxAge: 600000000
  }
}));

app.use(function myMiddleware(request, response, next) {
  console.log(request.method, request.path);
  var contents = request.method + ' ' + request.path + '\n';
  fs.appendFile('log.txt', contents, function(err) {
    next();
  });
});

app.use(bodyParser.urlencoded({ extended: false }));

const db = pgp({
  database: 'restaurant_db_v2'
});

app.use(function(req, resp, next) {
  resp.locals.session = req.session;
  next();
});

app.get('/login', function(req, resp) {
  resp.render('login.hbs');
});

app.post('/submit_login', function(req, resp) {
  var username = req.body.username;
  var password = req.body.password;

  // 1. get username and password from form
  // 2. get encrypted password from the reviewer table
  // 3. compare encrypted password with plain password
  // 4. if match
  //    * log them in by saving their name into session, redirect to /
  //    * else redirect to /login
  db.one(`select id, password from reviewer where name = $1`, username)
    .then(function(result) {
      return [result, bcrypt.compare(password, result.password)];
    })
    .spread(function(result, matched) {
      if (matched) {
        req.session.loggedInUser = username;
        req.session.loggedInUserID = result.id;
        resp.redirect('/');
      } else {
        resp.redirect('/login');
      }
    })
    .catch(function(err) {
      resp.redirect('/login');
    });
});

app.get('/', function(req, resp) {
  resp.render('search_form.hbs');
});

app.get('/search', function(req, resp, next) {
  let searchTerm = req.query.searchTerm;
  //console.log('Term:', term);
  let sql = `select * from restaurant where name ilike $1`;

  db.any(sql, `%${searchTerm}%`)
    .then(function(results) {
      //console.log('results', resultsArray);
      resp.render('search_results.hbs', {
        layout: false,
        title: `Results for "${searchTerm}"`,
        results: results
      });
    })
    .catch(next);
});

app.get('/restaurant/:id', function(req, resp, next) {
  let id = req.params.id;
  let sql = `
    select
      reviewer.name as reviewer_name,
      review.title,
      review.stars,
      review.review
    from
      restaurant
    inner join
      review on review.restaurant_id = restaurant.id
    left outer join
      reviewer on review.reviewer_id = reviewer.id
    where restaurant.id = $1
  `;
  //console.log(sql);
  db.any(sql, id)
    .then(function(reviews) {
      return [
        reviews,
        db.one(`
          select name as restaurant_name, * from restaurant
          where id = $1`, id)
      ];
    })
    .spread(function(reviews, restaurant) {
      resp.render('restaurant.hbs', {
        restaurant: restaurant,
        reviews: reviews
      });
    })
    .catch(next);
});

app.get('/signup', function(req, resp) {
  resp.render('signup.hbs');
});

app.post('/submit_signup', function(req, resp, next) {
  var info = req.body;
  // 1. encrypt password
  // 2. save info to reviewer table
  // 3. log the user in
  // 4. redirect back to home page
  bcrypt.hash(info.password, 10)
    .then(function(encryptedPassword) {
      return db.none(`
        insert into reviewer (name, email, password) values
        ($1, $2, $3)
      `, [info.username, info.email, encryptedPassword]);
    })
    .then(function() {
      req.session.loggedInUser = info.username;
      resp.redirect('/');
    })
    .catch(next);
});

app.use(function authentication(req, resp, next) {
  if (req.session.loggedInUser) {
    next();
  } else {
    resp.redirect('/login');
  }
});

app.post('/submit_review/:id', function(req, resp, next) {
  var restaurantId = req.params.id;
  //console.log('restaurant ID', restaurantId);
  //console.log('from the form', req.body);
  db.none(`insert into review values
    (default, $1, $2, $3, $4, $5)`,
    [req.session.loggedInUserID, req.body.stars, req.body.title, req.body.review, restaurantId])
    .then(function() {
      resp.redirect(`/restaurant/${restaurantId}`);
    })
    .catch(next);
});

app.listen(3000, function() {
  console.log('Listening on port 3000.');
});
