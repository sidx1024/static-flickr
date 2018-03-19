const dotenv = require('dotenv').config();
const assert = require('assert');
const promisify = require('util').promisify;
const fs = require('fs');
const express = require('express');
const app = express();

app.get('/refresh/' + process.env.CACHE_REFRESH_TOKEN, function (req, res) {
  res.send('gallery.json will be refreshed momentarily.');
  rebuildJSON();
});

const PORT = 80;
const server = app.listen(PORT, function () {
  console.info('Server is listening at', PORT);
});

app.use(express.static(__dirname + '/public'));

function rebuildJSON() {
  if (!process.env.FLICKR_API_KEY || !process.env.FLICKR_SECRET) {
    assert(0, 'Flickr API key or secret not set in .env');
  }

  const Flickr = require('flickrapi'),
    flickrOptions = {
      api_key: process.env.FLICKR_API_KEY,
      secret: process.env.FLICKR_SECRET
    };

  const reuse = {
    photos: {}
  };

  const wrapperPromise = (id) => {
    return new Promise((resolve, reject) => {
      promisify(reuse.flickr.photos.getSizes)({photo_id: id})
        .then(function (sizes) {
          resolve({id, sizes});
        }).catch(reject);
    });
  };

  const chain = promisify(Flickr.tokenOnly);
  chain(flickrOptions)
    .then((flickr) => {
      reuse.flickr = flickr;
      return promisify(reuse.flickr.people.getPhotos)(
        {api_key: process.env.FLICKR_API_KEY, user_id: process.env.FLICKR_USER_ID});
    })
    .then((result) => {
      result.photos.photo.map((photo) => {
        reuse.photos[photo.id] = photo;
      });
      return result.photos.photo.map((photo) => (photo.id));
    })
    .then((listOfIds) => {
      return Promise.all(listOfIds.map((id) => {
        return wrapperPromise(id);
      }));
    })
    .then((mappedSizes) => {
      mappedSizes.map((obj) => {
        reuse.photos[obj.id].sizes = obj.sizes.sizes.size;
      });
      return JSON.stringify({meta: {lastModified: Date.now()}, data: reuse.photos}, null, 2);
    })
    .then((json) => {
      fs.writeFile('public/gallery.json', json, {}, () => {});
    })
    .catch(console.error);
}
