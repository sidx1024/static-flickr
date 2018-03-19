# Static Flickr
Builds an updated json file for your flickr profile.

## What
This app will build a json file containing all photos of a flickr profile (including all image sizes). 

## Usage
1. Setup .env file with Flickr API credentials. (refer ```.env.sample```)
2. ```npm start```
3. Wait for sometime and let the build process complete.
4. Access ```http://<your_host>/gallery.json```, server path is ```public/gallery.json```.
5. To rebuild/refresh the json, you can access an endpoint:
```http://<your_host>/refresh/<CACHE_REFRESH_TOKEN_IN_ENV>```
This is to prevent refresh flooding as flickr only provides 3600 queries per hour.

## Authors
- [Chintan Acharya](https://github.com/ChintanAcharya)
- [Siddharth Goswami](https://github.com/sidx1024)

