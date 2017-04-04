Smooth plugin for Meister player
====

Allows playback of Smooth streams using the [HasPlayer](https://github.com/Orange-OpenSource/hasplayer.js) library.

Getting started
----

To start using smooth simply add the ```Smooth``` object in your Meister configuration and configure the item to have the type ```mss```.

``` JavaScript
var meisterPlayer = new Meister('#player', {
    Smooth: {}
});

meisterPlayer.setItem({
    src: 'INSERT_SMOOTH_STREAM_URL_HERE',
    type: 'mss',
});
```
