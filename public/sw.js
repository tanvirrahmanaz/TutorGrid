self.addEventListener('install',()=>self.skipWaiting())
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()))
self.addEventListener('push',event=>{
  let data={title:'TutorGrid reminder',body:'You have an upcoming class.',url:'/calendar'}
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon.svg',badge:'/icon.svg',data:{url:data.url}}))
})
self.addEventListener('notificationclick',event=>{
  event.notification.close(); const url=event.notification.data?.url||'/calendar';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c){c.navigate(url);return c.focus()}}return clients.openWindow(url)}))
})
