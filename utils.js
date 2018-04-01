const dotenv = require('dotenv').config();
const promisify = require('util').promisify;
const fs = require('fs');

class StaticFlickr {
  constructor(options) {
    this.Flickr = require('flickrapi');

    this.flickrOptions = {
      api_key: options.api_key,
      secret: options.secret,
      developer_id: options.developer_id,
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
    const {api_key, developer_id, user_id} = this.flickrOptions;

    const cache = {
      photosets: {}
    };

    const photosetMap = {};
    const mappedSizes = {};

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
          const filteredPhotoList = obj.photoset.photo.map((photo) =>
            (this.filterObjectKeys(photo, ['id', 'title']))
          );
          cache.photosets[obj.id].photos = filteredPhotoList.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {});
        });
        let listOfPhotoIds = [];
        Object.values(cache.photosets).map((photoset) => {
          listOfPhotoIds = listOfPhotoIds.concat(
            Object.keys(photoset.photos).map((photoId) => {
              photosetMap[photoId] = photoset.id;
              return photoId;
            })
          );
        });
        return listOfPhotoIds;
      })
      .then((listOfPhotoIds) => {
        return Promise.all(listOfPhotoIds.map((photoId) => {
          return new Promise((resolve, reject) => {
            promisify(flickr.photos.getSizes)({photo_id: photoId})
              .then((sizes) => {
                const labeledSizes = {};
                sizes.sizes.size.map((size) => {
                  labeledSizes[this.jsonFriendlyName(size.label)] = size;
                });
                mappedSizes[photoId] = labeledSizes;
                resolve();
              })
              .catch(reject);
          });
        }));
      })
      .then(() => {
        Object.values(cache.photosets).map((photoset) => {
          Object.values(photoset.photos).map((photo) => {
            cache.photosets[photoset.id].photos[photo.id].sizes = mappedSizes[photo.id];
            console.log('>>', photo.id, cache.photosets[photoset.id].photos[photo.id].sizes.thumbnail.source);
          })
        })
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
