const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 1. Utils
function openFile(filePath) {
    const cmd = process.platform === 'darwin' ? `open "${filePath}"` : `start "" "${filePath}"`;
    exec(cmd);
}

// IPC Wrapper for LLM
function callLLM(systemPrompt, userMessages) {
    return new Promise((resolve, reject) => {
        const requestId = Date.now().toString() + Math.random().toString();

        const handleMessage = (msg) => {
            if (msg.type === 'llm-response' && msg.id === requestId) {
                process.off('message', handleMessage);
                if (msg.payload.error) {
                    reject(new Error(msg.payload.error));
                } else {
                    resolve(msg.payload.content);
                }
            }
        };

        process.on('message', handleMessage);

        const messages = Array.isArray(userMessages) ? userMessages : [{ role: 'user', content: userMessages }];

        process.send({
            type: 'llm-request',
            id: requestId,
            payload: {
                systemPrompt: systemPrompt,
                messages: messages
            }
        });
    });
}

// 2. Main Logic
(async () => {
    try {
        console.log("Travel Planner started...");

        // Parse Args
        const args = JSON.parse(process.argv[2] || '{}');
        const { origin, destination, duration, budget, travelers, time } = args;

        if (!destination) {
            console.error("Missing destination");
            process.exit(1);
        }

        console.log(`Planning trip to ${destination}...`);

        // Use IPC provided LLM
        const systemPrompt = `You are an expert Travel Planner. 
Your task is to generate a detailed JSON travel itinerary based on the user's request.
The itinerary must consider:
- Weather conditions.
- Suitable activities for the party.
- REALISTIC PRICE ESTIMATES based on typical market rates.
- GEOGRAPHIC LOGIC: Ensure efficient routes.

Output JSON format:
{
    "title": "Trip Title",
    "destination_image_query": "Destination City Scenery",
    "summary": "Brief summary",
    "weather": "30°C Sunny",
    "tips": ["Tip 1"],
    "budget_breakdown": { 
        "transport": "¥2000", 
        "accommodation": "¥3000",
        "food": "¥1500",
        "activities": "¥500",
        "total": "¥7000"
    },
    "transport_recommendation": {
        "title": "Flight/Train to Destination",
        "details": "e.g. CA1234",
        "price_estimates": [{ "source": "Ctrip", "price": "¥800" }]
    },
    "days": [
        {
            "day": 1,
            "theme": "Arrival & Relax",
            "hotel": {
                "name": "Hotel Name",
                "coordinates": { "lat": 18.25, "lng": 109.5 }, 
                "price_estimates": [...]
            },
            "activities": [
                { 
                    "time": "10:00", 
                    "title": "Activity Name", 
                    "description": "...",
                    "image_query": "...",
                    "coordinates": { "lat": 18.26, "lng": 109.51 },
                    "navigation": { 
                        "from": "Hotel/Previous Spot",
                        "mode": "taxi", 
                        "duration": "15 min", 
                        "distance": "5 km",
                         "price": "¥30"
                    },
                    "type": "Sightseeing",
                    "cost": "¥50"
                }
            ],
            "activities": [
                { 
                    "time": "10:00", 
                    "title": "Activity Name", 
                    "description": "...",
                    "image_query": "...",
                    "coordinates": { "lat": 18.26, "lng": 109.51 },
                    "navigation": { 
                        "from": "Hotel/Previous Spot",
                        "mode": "taxi", 
                        "duration": "15 min", 
                        "distance": "5 km",
                         "price": "¥30"
                    },
                    "type": "Sightseeing",
                    "cost": "¥50"
                }
            ],
            "food": { 
                "name": "Local Specialty Restaurant Name", 
                "details": "Signature Dish: ...",
                "price_estimates": [{ "source": "Dianping", "price": "¥100/person" }] 
            }
        }
    ]
}
Return ONLY JSON. Ensure coordinates are approximately correct for the real location.
CRITICAL: You MUST provide a specific restaurant or food recommendation for EVERY DAY. Do not leave it empty.`;

        const userPrompt = `Origin: ${origin || 'Any'}
Destination: ${destination}
Duration: ${duration}
Budget: ${budget || 'Flexible'}
Travelers: ${travelers || 'Solo'}
Time: ${time || 'Soon'}

Please generate the full itinerary with specific price comparisons, coordinates, and navigation advice. Ensure all text is in Simplified Chinese.`;

        const jsonStr = await callLLM(systemPrompt, userPrompt);

        // Parse JSON with robust regex
        let plan;
        const jsonMatch = jsonStr.match(/```json([\s\S]*?)```/);

        try {
            const cleanJson = jsonMatch ? jsonMatch[1] : jsonStr.replace(/```json\n?|\n?```/g, '').trim();
            plan = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Failed to parse LLM output:", jsonStr);
            plan = { title: "旅行计划", summary: jsonStr, weather: "N/A", tips: [], budget_breakdown: {}, days: [] };
        }

        // Generate HTML with images and Maps
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${plan.title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
        body { font-family: 'Noto Sans SC', sans-serif; }
        .source-ctrip { color: #2b74ca; background: #eafdff; border-color: #2b74ca; }
        .source-qunar { color: #d32f2f; background: #fff5f5; border-color: #d32f2f; }
        .source-dianping { color: #ff6600; background: #fff0e6; border-color: #ff6600; }
        .badge { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; border: 1px solid; font-weight: 600; margin-right: 4px; }
        .map-container { height: 300px; width: 100%; border-radius: 12px; z-index: 0; box-shadow: inset 0 0 20px rgba(0,0,0,0.05); }
    </style>
</head>
<body class="bg-gray-50 text-gray-800">
    <header class="bg-indigo-600 text-white shadow-lg relative overflow-hidden min-h-[400px] flex items-end">
         <!-- Dynamic Background Image (Bing) -->
        <img src="https://tse3.mm.bing.net/th?q=${encodeURIComponent(plan.destination_image_query || plan.title)}&w=1200&h=600&c=7&rs=1&p=0" 
             referrerpolicy="no-referrer"
             class="absolute inset-0 w-full h-full object-cover text-gray-400" 
             alt="Destination"
             onerror="this.src='https://loremflickr.com/1200/600/travel,scenery'">
        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-90"></div>
        <div class="relative max-w-4xl mx-auto px-6 py-12 w-full">
            <h1 class="text-5xl font-extrabold mb-4 tracking-tight text-white drop-shadow-lg">${plan.title}</h1>
            <p class="text-xl text-gray-100 max-w-2xl whitespace-pre-line drop-shadow-md leading-relaxed">${plan.summary}</p>
            <div class="mt-8 flex flex-wrap gap-4 text-sm font-medium">
                <span class="bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">🗓️ ${time || '近期'}</span>
                <span class="bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">👥 ${travelers || '多人'}</span>
                <span class="bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">💰 ${budget || '预算不限'}</span>
            </div>
        </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-10 space-y-12 -mt-8 relative z-10">
        <!-- Transport Recommendation -->
        ${plan.transport_recommendation ? `
        <section class="bg-white p-6 rounded-2xl shadow-xl border border-gray-100/50 backdrop-blur-sm">
             <h3 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2"><span>✈️</span> 往返大交通 (Getting There)</h3>
             <div class="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <div class="font-semibold text-gray-900">${plan.transport_recommendation.title}</div>
                    <div class="text-sm text-gray-500">${plan.transport_recommendation.details}</div>
                </div>
                <div class="flex gap-2">
                    ${(plan.transport_recommendation.price_estimates || []).map(p => `
                        <a href="${p.link || '#'}" target="_blank" class="badge bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 transition no-underline">${p.source}: ${p.price}</a>
                    `).join('')}
                </div>
             </div>
        </section>` : ''}

        <!-- Breakdown & Tips -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-2xl shadow-xl border border-gray-100/50 backdrop-blur-sm">
                <h3 class="text-lg font-bold text-gray-900 mb-3">🌦️ 天气与贴士 (Weather & Tips)</h3>
                <p class="text-gray-600 mb-4">${plan.weather}</p>
                <ul class="space-y-2">
                    ${(plan.tips || []).map(tip => `<li class="flex items-start gap-2 text-sm text-gray-600"><span class="text-indigo-500">•</span>${tip}</li>`).join('')}
                </ul>
            </div>
            <div class="bg-white p-6 rounded-2xl shadow-xl border border-gray-100/50 backdrop-blur-sm">
                <h3 class="text-lg font-bold text-gray-900 mb-3">💳 预算明细 (Budget Breakdown)</h3>
                <div class="space-y-3">
                    ${(() => {
                const b = plan.budget_breakdown || {};
                const items = [
                    { k: 'transport', label: '✈️ 交通' },
                    { k: 'accommodation', label: '🏨 住宿' },
                    { k: 'food', label: '🍽️ 餐饮' },
                    { k: 'activities', label: '🎫 门票/活动' },
                    { k: 'other', label: '🛍️ 其他' }
                ];
                let html = items.map(item => `
                            <div class="flex justify-between items-center text-sm">
                                <span class="text-gray-500">${item.label}</span>
                                <span class="font-semibold text-gray-900">${b[item.k] || b[item.k.toLowerCase()] || '--'}</span>
                            </div>
                        `).join('');

                // Total
                if (b.total) {
                    html += `
                            <div class="flex justify-between items-center text-sm pt-3 mt-3 border-t border-dashed border-gray-200">
                                <span class="text-gray-800 font-bold">总计预估</span>
                                <span class="font-bold text-indigo-600 text-base">${b.total}</span>
                            </div>`;
                }
                return html;
            })()}
                </div>
            </div>
        </section>

        <!-- Itinerary -->
        <section>
            <h2 class="text-2xl font-bold text-gray-900 mb-8 pb-4 border-b">每日行程 (Daily Itinerary)</h2>
            <div class="space-y-16">
                ${(plan.days || []).map((day, dayIdx) => `
                    <div class="relative pl-8 border-l-2 border-indigo-100 pb-12 last:pb-0">
                        <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-50"></div>
                        
                        <div class="flex justify-between items-end mb-6">
                             <h3 class="text-2xl font-bold text-gray-900">Day ${day.day}: ${day.theme}</h3>
                        </div>

                        <!-- MAP CONTAINER -->
                        <div id="map-day-${dayIdx}" class="map-container mb-8 border border-gray-200"></div>

                        <div class="space-y-8 mb-8">
                            ${(day.activities || []).map((act, actIdx) => `
                                <!-- Transport Info (if available) -->
                                ${act.navigation ? `
                                <div class="flex items-center gap-2 pl-4 py-2 text-xs font-semibold text-gray-500 border-l-2 border-dashed border-gray-300 ml-4">
                                    <span class="bg-gray-100 px-2 py-1 rounded text-gray-600">
                                        ${act.navigation.mode === 'taxi' ? '🚕 打车' : act.navigation.mode === 'walk' ? '🚶 步行' : '🚌 公交'} 
                                        ${act.navigation.duration}
                                    </span>
                                    <span>${act.navigation.distance || ''}</span>
                                    ${act.navigation.price ? `<span class="text-orange-500">(${act.navigation.price})</span>` : ''}
                                </div>
                                ` : ''}

                                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 group">
                                    <div class="flex flex-col md:flex-row">
                                        <div class="w-full md:w-48 h-48 relative overflow-hidden bg-gray-100 shrink-0">
                                            <img src="https://tse3.mm.bing.net/th?q=${encodeURIComponent(act.image_query || act.title)}&w=400&h=400&c=7&rs=1&p=0"
                                                 loading="lazy" referrerpolicy="no-referrer"
                                                 class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                                 alt="${act.title}" onerror="this.src='https://loremflickr.com/400/400/travel'">
                                        </div>
                                        <div class="p-6 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div class="flex justify-between items-start mb-3">
                                                    <h4 class="font-bold text-lg text-gray-900 group-hover:text-indigo-600 transition-colors">${act.title}</h4>
                                                    <span class="text-xs font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">${act.time}</span>
                                                </div>
                                                <p class="text-sm text-gray-600 leading-relaxed mb-4">${act.description}</p>
                                            </div>
                                            <div class="flex items-center gap-4 text-xs font-medium text-gray-500">
                                                <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">🏷️ ${act.type || 'Activity'}</span>
                                                <span class="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">💵 ${act.cost || '--'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                         <!-- Hotel & Food -->
                         <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="bg-gradient-to-br from-orange-50 to-white p-4 rounded-xl border border-orange-100 shadow-sm">
                                <span class="text-xs font-bold text-orange-600 uppercase tracking-wide">🏨 住宿推荐 (Accommodation)</span>
                                <div class="mt-2 font-bold text-gray-900">${(typeof day.hotel === 'string' ? day.hotel : day.hotel.name) || '未指定酒店'}</div>
                                <div class="text-xs text-gray-500 mb-2">${day.hotel.reason || ''}</div>
                                <div class="flex flex-wrap gap-2 mt-2">
                                     ${(day.hotel.price_estimates || []).map(p => `
                                        <span class="badge source-ctrip">${p.source}: ${p.price || '--'}</span>
                                     `).join('')}
                                </div>
                            </div>
                            <div class="bg-gradient-to-br from-green-50 to-white p-4 rounded-xl border border-green-100 shadow-sm">
                                <span class="text-xs font-bold text-green-600 uppercase tracking-wide">🍽️ 餐饮推荐 (Food)</span>
                                <div class="mt-2 font-bold text-gray-900">${(typeof day.food === 'string' ? day.food : day.food.name) || '未指定餐厅'}</div>
                                <div class="text-xs text-gray-500 mb-2">${day.food.details || ''}</div>
                                <div class="flex flex-wrap gap-2 mt-2">
                                     ${(day.food.price_estimates || []).map(p => `
                                        <span class="badge source-dianping">${p.source}: ${p.price || '--'}</span>
                                     `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    </main>

    <script>
        // Initialize Maps
        const planData = ${JSON.stringify(plan)};
        
        document.addEventListener('DOMContentLoaded', () => {
            planData.days.forEach((day, idx) => {
                const mapId = 'map-day-' + idx;
                const mapEl = document.getElementById(mapId);
                if (!mapEl) return;

                // Collect points: Hotel -> Activities
                const points = [];
                if (day.hotel && day.hotel.coordinates) {
                    points.push({ ...day.hotel.coordinates, title: "🏨 " + (day.hotel.name || 'Hotel') });
                }
                if (day.activities) {
                    day.activities.forEach(act => {
                        if (act.coordinates) {
                            points.push({ ...act.coordinates, title: "📍 " + act.title });
                        }
                    });
                }

                if (points.length === 0) {
                    mapEl.style.display = 'none'; // Hide if no valid coords
                    return;
                }

                // Init Leaflet
                const center = points[0];
                const map = L.map(mapId).setView([center.lat, center.lng], 13);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(map);

                // Add Markers & Polyline
                const latLngs = [];
                points.forEach(p => {
                    if(p.lat && p.lng) {
                        L.marker([p.lat, p.lng]).addTo(map)
                            .bindPopup(p.title);
                        latLngs.push([p.lat, p.lng]);
                    }
                });

                if (latLngs.length > 1) {
                    L.polyline(latLngs, { color: '#6366f1', weight: 4, dashArray: '10, 10', opacity: 0.7 }).addTo(map);
                    map.fitBounds(latLngs, { padding: [50, 50] });
                }
            });
        });
    </script>
</body>
</html>`;

        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const desktopDir = path.join(homeDir, 'Desktop');
        // Ensure desktop exists, fallback to home
        const outDir = fs.existsSync(desktopDir) ? desktopDir : homeDir;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const reportPath = path.join(outDir, `TravelPlan_${destination}_${timestamp}.html`);

        fs.writeFileSync(reportPath, html);
        console.log(`Successfully generated travel plan: ${reportPath}`);

        // Notify UI about new artifact
        if (process.send) {
            process.send({
                type: 'artifact',
                payload: {
                    name: `Travel Plan - ${destination}`,
                    path: reportPath,
                    type: 'file'
                }
            });
        }

        openFile(reportPath);

    } catch (e) {
        console.error("Check Error:", e);
    }
})();
