// sw.js - Service Worker per Vinificatori PWA
const CACHE_NAME = 'vinificatori-pwa-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cache aperta');
                return cache.addAll(urlsToCache);
            })
    );
});

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminazione cache vecchia:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Intercettazione delle richieste di rete
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - restituisci la risposta dalla cache
                if (response) {
                    return response;
                }
                
                // Clona la richiesta
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then((response) => {
                    // Controlla se la risposta è valida
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clona la risposta
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                }).catch(() => {
                    // Fallback offline - restituisci una pagina di errore personalizzata
                    if (event.request.destination === 'document') {
                        return caches.match('/');
                    }
                });
            })
    );
});

// Background Sync per sincronizzazione dei dati vinificatori
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-vinificatori') {
        console.log('[SW] Background sync vinificatori avviata');
        event.waitUntil(syncVinificatoriData());
    }
});

// Push notifications per promemoria vinificatori
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Controlla le attività dei tuoi vinificatori',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 'vinificatori-reminder'
        },
        actions: [
            {
                action: 'view-vinificatori',
                title: 'Vinificatori',
                icon: '/images/grape.png'
            },
            {
                action: 'view-todo',
                title: 'Todo List',
                icon: '/images/check.png'
            },
            {
                action: 'dismiss',
                title: 'Chiudi',
                icon: '/images/close.png'
            }
        ],
        tag: 'vinificatori-reminder'
    };
    
    event.waitUntil(
        self.registration.showNotification('🍷 Vinificatori PWA', options)
    );
});

// Gestione click sulle notifiche
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view-vinificatori') {
        event.waitUntil(
            clients.openWindow('/?page=vinificatori')
        );
    } else if (event.action === 'view-todo') {
        event.waitUntil(
            clients.openWindow('/?page=todo')
        );
    } else if (event.action === 'dismiss') {
        // Notifica chiusa senza azioni
        console.log('[SW] Notifica chiusa dall\'utente');
    } else {
        // Click principale sulla notifica
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Funzione per sincronizzare i dati dei vinificatori
async function syncVinificatoriData() {
    try {
        console.log('[SW] Avvio sincronizzazione dati vinificatori...');
        
        // Recupera i dati dal localStorage (simulato in SW)
        // In una implementazione reale, questi dati sarebbero recuperati
        // da IndexedDB o inviati dal client
        
        const syncData = {
            timestamp: Date.now(),
            source: 'background-sync',
            type: 'vinificatori-data'
        };
        
        // Simula chiamata API per sync
        const response = await fetch('/api/sync-vinificatori', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(syncData)
        }).catch((error) => {
            console.log('[SW] Sync fallita - modalità offline:', error);
            return null;
        });
        
        if (response && response.ok) {
            const data = await response.json();
            console.log('[SW] Sync completata:', data);
            
            // Notifica l'utente se ci sono aggiornamenti importanti
            if (data.hasUpdates || data.newPriorities) {
                await self.registration.showNotification('📊 Dati Aggiornati', {
                    body: 'I tuoi dati vinificatori sono stati sincronizzati',
                    icon: '/icon-192x192.png',
                    tag: 'sync-complete',
                    requireInteraction: false
                });
            }
            
            // Invia messaggio al client principale se aperto
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'sync-complete',
                    data: data
                });
            });
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error('[SW] Errore durante sync:', error);
        return Promise.reject(error);
    }
}

// Gestione messaggi dal client
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.action === 'syncNow') {
        syncVinificatoriData().then(() => {
            event.ports[0].postMessage({success: true});
        }).catch((error) => {
            event.ports[0].postMessage({success: false, error: error.message});
        });
    }
    
    if (event.data.action === 'scheduleReminder') {
        // Programma promemoria per controlli vinificatori
        const { vinificatore, sector, time } = event.data;
        scheduleVinificatoreReminder(vinificatore, sector, time);
    }
});

// Funzione per programmare promemoria
function scheduleVinificatoreReminder(vinificatore, sector, time) {
    // In una implementazione reale, qui potresti usare setTimeout
    // o integrarti con un sistema di notifiche push
    console.log(`[SW] Promemoria programmato per ${vinificatore} - ${sector} alle ${time}`);
    
    // Simula programmazione promemoria
    const reminderData = {
        vinificatore,
        sector,
        time,
        scheduled: new Date().toISOString()
    };
    
    // Salva in IndexedDB per persistenza (simulato)
    console.log('[SW] Promemoria salvato:', reminderData);
}

// Gestione aggiornamenti dell'app
self.addEventListener('message', (event) => {
    if (event.data.action === 'update') {
        // Forza l'aggiornamento del Service Worker
        self.skipWaiting();
    }
});

// Periodic Background Sync per controlli periodici (se supportato)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'vinificatori-daily-check') {
        event.waitUntil(performDailyCheck());
    }
});

// Controllo giornaliero delle attività
async function performDailyCheck() {
    try {
        console.log('[SW] Controllo giornaliero attività vinificatori');
        
        // Simula controllo delle attività in scadenza
        const checkResult = {
            pendingActivities: Math.floor(Math.random() * 5),
            priorityVinificatori: Math.floor(Math.random() * 3),
            overdueItems: Math.floor(Math.random() * 2)
        };
        
        // Se ci sono attività urgenti, mostra notifica
        if (checkResult.pendingActivities > 0 || checkResult.overdueItems > 0) {
            await self.registration.showNotification('⏰ Controllo Giornaliero', {
                body: `${checkResult.pendingActivities} attività da completare${checkResult.overdueItems > 0 ? `, ${checkResult.overdueItems} in ritardo` : ''}`,
                icon: '/icon-192x192.png',
                badge: '/badge-72x72.png',
                tag: 'daily-check',
                actions: [
                    {
                        action: 'view-activities',
                        title: 'Visualizza'
                    },
                    {
                        action: 'snooze',
                        title: 'Posticipa'
                    }
                ]
            });
        }
        
        return Promise.resolve(checkResult);
    } catch (error) {
        console.error('[SW] Errore controllo giornaliero:', error);
        return Promise.reject(error);
    }
}

// Gestione errori globali nel SW
self.addEventListener('error', (event) => {
    console.error('[SW] Errore:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Promise rejection non gestita:', event.reason);
});

// Log quando il SW è pronto
console.log('[SW] Service Worker Vinificatori PWA caricato');

// Utility per debugging
self.addEventListener('message', (event) => {
    if (event.data.action === 'getStatus') {
        event.ports[0].postMessage({
            status: 'active',
            version: 'v2.0',
            caches: CACHE_NAME,
            timestamp: new Date().toISOString()
        });
    }
});