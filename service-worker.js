// Service Worker: Cache management for HTTP/HTTPS deployment
var CACHE_VERSION='manga-editor-1.6.2-offline-shell';
// App shell precached at install so the installed app (start_url ./) opens offline (audit 22).
var APP_SHELL=['./index.html','./manifest.json'];
var STATIC_EXTENSIONS=[
'.css','.js','.png','.jpg','.jpeg','.gif','.svg','.ico',
'.woff','.woff2','.ttf','.eot','.otf',
'.html','.json'
];

function isStaticAsset(url){
var pathname=url.pathname.toLowerCase();
return STATIC_EXTENSIONS.some(function(ext){
return pathname.endsWith(ext);
});
}

function isApiCall(url){
return url.pathname.includes('/api/');
}

self.addEventListener('install',function(event){
self.skipWaiting();
event.waitUntil(caches.open(CACHE_VERSION).then(function(cache){
return Promise.all(APP_SHELL.map(function(item){return cache.add(item).catch(function(){});}));
}));
});

function shellUrl(){return new URL('./index.html',self.registration&&self.registration.scope||self.location.href).href;}
function isNavigation(request,url){
return request.mode==='navigate'||url.pathname.endsWith('/');
}

self.addEventListener('activate',function(event){
event.waitUntil(
caches.keys().then(function(keys){
return Promise.all(
keys.filter(function(key){
return key!==CACHE_VERSION;
}).map(function(key){
return caches.delete(key);
})
);
}).then(function(){
return self.clients.claim();
})
);
});

self.addEventListener('fetch',function(event){
var url=new URL(event.request.url);

if(url.protocol==='file:'){
return;
}

if(!url.pathname.startsWith('/')){
return;
}

if(event.request.method!=='GET'){
return;
}

if(isNavigation(event.request,url)&&!isApiCall(url)){
// Every navigation (/, /index.html, ?query) falls back to the cached index.html when offline.
event.respondWith(
fetch(event.request,{cache:'no-store'}).then(function(response){
if(response&&response.status===200&&response.type==='basic'){
var clone=response.clone();
caches.open(CACHE_VERSION).then(function(cache){cache.put(shellUrl(),clone);});
}
return response;
}).catch(function(){
return caches.match(event.request).then(function(hit){return hit||caches.match(shellUrl());});
})
);
return;
}

if(isApiCall(url)){
event.respondWith(
fetch(event.request).then(function(response){
var clone=response.clone();
caches.open(CACHE_VERSION).then(function(cache){
cache.put(event.request,clone);
});
return response;
}).catch(function(){
return caches.match(event.request);
})
);
return;
}

if(isStaticAsset(url)){
event.respondWith(
fetch(event.request,{cache:'no-store'}).then(function(response){
if(!response||response.status!==200||response.type!=='basic'){
return response;
}
var clone=response.clone();
caches.open(CACHE_VERSION).then(function(cache){
cache.put(event.request,clone);
});
return response;
}).catch(function(){
return caches.match(event.request);
})
);
return;
}

event.respondWith(
fetch(event.request).catch(function(){
return caches.match(event.request);
})
);
});
