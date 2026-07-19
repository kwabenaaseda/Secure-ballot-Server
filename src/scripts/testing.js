const items = [
    "Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
    "Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
    "Mozilla/5.0 (Macintosh; PPC Mac OS X x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
    "Mozilla/5.0 (X11; Linux i686; rv:10.0) Gecko/20100101 Firefox/10.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0",
    "Mozilla/5.0 (Maemo; Linux armv7l; rv:10.0) Gecko/20100101 Firefox/10.0 Fennec/10.0",
    "Mozilla/5.0 (Android; Mobile; rv:40.0) Gecko/40.0 Firefox/40.0",
    "Mozilla/5.0 (Android; Tablet; rv:40.0) Gecko/40.0 Firefox/40.0",
    "Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0",
    "Mozilla/5.0 (Android 4.4; Tablet; rv:41.0) Gecko/41.0 Firefox/41.0"
]

items.forEach(e=>{
    let source = e.split(" ");

    let form = {
        product: e[0],
        sys:e[1],
        gec:e[2],
        other:e.slice(2)
    }
   // console.log(source)
   if (e.toLowerCase().includes("mobile")){
    console.log(`MOBILE_APP:${source}`)
   }else{
    console.log(`DESKTOP_APP:${source}`)
   }
})