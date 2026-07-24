# Local globe assets

- `vendor/three.module.min.js`, `vendor/three.core.min.js`, and `vendor/RoomEnvironment.js` are Three.js 0.180.0 assets bundled locally under the MIT license in `vendor/THREE-LICENSE.txt`.
- `assets/earth-countries-2048.png` is a local equirectangular map texture generated from the Natural Earth-derived `datasets/geo-countries` country polygons. The source data is public domain under the [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/). The source repository is [datasets/geo-countries](https://github.com/datasets/geo-countries).
- `assets/earth-material-2048.png`, `assets/earth-relief-2048.png`, and `assets/earth-roughness-2048.png` are locally generated material maps derived from that geographic source. They add restrained stone variation, relief, and non-uniform roughness without introducing runtime dependencies.

The runtime has no CDN dependency. Both the renderer and the geographic texture are served from this standalone prototype directory.
