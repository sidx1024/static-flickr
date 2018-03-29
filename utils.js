const dotenv = require('dotenv').config();
const promisify = require('util').promisify;
const fs = require('fs');

class StaticFlickr {
  constructor(options) {
    this.Flickr = require('flickrapi');

    this.flickrOptions = {
      api_key: options.api_key,
      secret: options.secret,
      user_id: options.user_id
    };
    this.flickrApiObject = false;

    this.getApiObject();
  }

  getApiObject(callback) {
    if (!this.flickrApiObject) {
      const {Flickr, flickrOptions} = this;
      Flickr.tokenOnly(flickrOptions, (error, flickr) => {
        if (error) {
          console.error('Error retrieving Flickr API Object');
        }
        this.flickrApiObject = flickr;
        if (typeof callback === 'function') {
          callback(flickr);
        }
      });
    }
  }

  getPhotos(callback) {
    const flickr = this.flickrApiObject;
    const {api_key, user_id} = this.flickrOptions;

    const cache = {
      photos: {}
    };

    const chain = promisify(flickr.people.getPhotos);

    chain({api_key, user_id})
      .then((result) => {
        result.photos.photo.map((photo) => {
          cache.photos[photo.id] = photo;
        });
        return result.photos.photo.map((photo) => (photo.id));
      })
      .then((listOfIds) => {
        return Promise.all(listOfIds.map((id) => {
          return new Promise((resolve, reject) => {
            promisify(flickr.photos.getSizes)({photo_id: id})
              .then((sizes) => {
                resolve({id, sizes});
              }).catch(reject);
          });
        }));
      })
      .then((mappedSizes) => {
        mappedSizes.map((obj) => {
          cache.photos[obj.id].sizes = obj.sizes.sizes.size;
        });
        return callback(false, cache.photos);
      })
      .catch((error) => {
        console.error(error);
        callback(true);
      });
  }

  getPhotoSetList(callback) {
    const flickr = this.flickrApiObject;
    const {api_key, user_id} = this.flickrOptions;

    const cache = {
      photosets: {}
    };

    const photosetMap = {};

    const chain = promisify(flickr.photosets.getList);
    chain({api_key, user_id})
      .then((result) => {
        return result.photosets.photoset.map((photoset) => {
          cache.photosets[photoset.id] = this.filterObjectKeys(photoset,
            ['id', 'title', 'description', 'count_views', 'date_create']);
          return photoset.id;
        });
      })
      .then((listOfIds) => {
        return Promise.all(listOfIds.map((id) => {
          return new Promise((resolve, reject) => {
            promisify(flickr.photosets.getPhotos)({photoset_id: id, user_id: user_id})
              .then((photoset) => {
                resolve({id, photoset: photoset.photoset});
              }).catch(reject);
          });
        }));
      })
      .then((mappedPhotoSetList) => {
        mappedPhotoSetList.map((obj) => {
          cache.photosets[obj.id].photos = obj.photoset.photo.map((photo) => {
            return this.filterObjectKeys(photo, ['id', 'title']);
          });
        });
        let listOfPhotoIds = [];
        Object.values(cache.photosets).map((photoset) => {
          listOfPhotoIds = listOfPhotoIds.concat(
            photoset.photos.map((photo) => {
              photosetMap[photo.id] = photoset.id;
              return photo.id;
            })
          );
        });
        return listOfPhotoIds;
      })
      .then((listOfPhotoIds) => {
        const labeledSizes = {};
        return Promise.all(listOfPhotoIds.map((id) => {
          return new Promise((resolve, reject) => {
            promisify(flickr.photos.getSizes)({photo_id: id})
              .then((sizes) => {
                sizes.sizes.size.map((size) => {
                   labeledSizes[this.jsonFriendlyName(size.label)] = size;
                });
                return labeledSizes;
              })
              .then((sizes) => { resolve({id, sizes}); })
              .catch(reject);
          });
        }));
      })
      .then((mappedSizes) => {
        mappedSizes.map((obj) => {
          cache.photosets[photosetMap[obj.id]].photos.map((photo) => {
            if (photo.id === obj.id) {
              photo.sizes = obj.sizes;
            }
          });
        });
        console.log(JSON.stringify(cache));
      })
      .then(() => (callback(false, cache.photosets)))
      .catch((error) => {
        console.error(error);
        callback(true);
      });
  }

  buildPhotoSetList(path) {
    this.getPhotoSetList((error, data) => {
      if (error) {
        console.error('Error retrieving photoset list.');
      } else {
        const json = JSON.stringify({meta: {lastModified: Date.now()}, data: data},
          null, 2);
        fs.writeFile(path, json, {}, () => {
          console.info('Photoset list json built successfully at', path);
        });
      }
    });
  }

  buildPhotosJson(path) {
    this.getPhotos((error, data) => {
      if (error) {
        console.error('Error retrieving photos.');
      } else {
        const json = JSON.stringify({meta: {lastModified: Date.now()}, data: data},
          null, 2);
        fs.writeFile(path, json, {}, () => {
          console.info('Photos json built successfully at', path);
        });
      }
    });
  }

  filterObjectKeys(obj, whitelist) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && whitelist.indexOf(key) === -1) {
        delete obj[key];
      }
    }
    return obj;
  }

  jsonFriendlyName(name) {
    return name.toLowerCase().trim().split(' ').join('-');
  }
}

module.exports = StaticFlickr;
