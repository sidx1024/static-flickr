const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const StaticFlickr = require('./utils');

const staticFlickr = new StaticFlickr({
  api_key: process.env.FLICKR_API_KEY,
  secret: process.env.FLICKR_SECRET,
  user_id: process.env.FLICKR_USER_ID
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.get('/refresh/photos/' + process.env.CACHE_REFRESH_TOKEN, function (req, res) {
  res.send('gallery.json will be refreshed momentarily.');
  staticFlickr.buildPhotosJson('public/gallery.json');
});

app.get('/refresh/photosets/' + process.env.CACHE_REFRESH_TOKEN, function (req, res) {
  res.send('photoset.json will be refreshed momentarily.');
  staticFlickr.buildPhotoSetList('public/photoset.json');
});

const PORT = 80;
const server = app.listen(PORT, function () {
  console.info('Server is listening at', PORT);
});

app.use(express.static(__dirname + '/public'));
