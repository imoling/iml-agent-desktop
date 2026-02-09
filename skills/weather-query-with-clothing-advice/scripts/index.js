const https = require('https');
const querystring = require('querystring');

const args = JSON.parse(process.argv[2] || '{}');
const city = args.city;
const days = args.days || 1;

if (!city) {
  console.error(JSON.stringify({ error: '城市名称不能为空' }));
  process.exit(1);
}

if (days < 1 || days > 7) {
  console.error(JSON.stringify({ error: '天数范围应为1-7天' }));
  process.exit(1);
}

// 使用和风天气API（免费版）
const apiKey = '4ca72e6979f84f048eeecdb4ef643826'; // 实际使用时需要替换为真实的API密钥
const apiUrl = `https://devapi.qweather.com/v7/weather/${days}d?`;

// 首先获取城市的地理位置信息
function getLocationId(cityName) {
  return new Promise((resolve, reject) => {
    const locationUrl = `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(cityName)}&key=${apiKey}`;
    
    https.get(locationUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === '200' && result.location && result.location.length > 0) {
            resolve(result.location[0].id);
          } else {
            reject(new Error(`未找到城市: ${cityName}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// 获取天气信息
function getWeather(locationId) {
  return new Promise((resolve, reject) => {
    const params = {
      location: locationId,
      key: apiKey
    };
    
    const url = apiUrl + querystring.stringify(params);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === '200') {
            resolve(result);
          } else {
            reject(new Error(`天气查询失败: ${result.code}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// 根据天气条件提供穿衣建议
function getClothingAdvice(weatherData) {
  const advice = {
    daily: []
  };
  
  if (weatherData.daily && weatherData.daily.length > 0) {
    weatherData.daily.forEach((day, index) => {
      const tempMax = parseInt(day.tempMax);
      const tempMin = parseInt(day.tempMin);
      const textDay = day.textDay;
      const textNight = day.textNight;
      const windScaleDay = day.windScaleDay;
      
      // 计算平均温度
      const avgTemp = (tempMax + tempMin) / 2;
      
      // 基础穿衣建议
      let clothing = '';
      let accessories = [];
      
      if (avgTemp >= 28) {
        clothing = '轻薄夏装（短袖、短裤、裙子）';
        accessories.push('遮阳帽', '太阳镜', '防晒霜');
      } else if (avgTemp >= 23) {
        clothing = '夏季服装（短袖、薄长裤）';
        accessories.push('遮阳帽');
      } else if (avgTemp >= 18) {
        clothing = '春秋装（长袖T恤、薄外套）';
      } else if (avgTemp >= 10) {
        clothing = '秋装（毛衣、夹克、长裤）';
        accessories.push('薄围巾');
      } else if (avgTemp >= 0) {
        clothing = '冬装（厚毛衣、羽绒服、保暖裤）';
        accessories.push('围巾', '手套', '帽子');
      } else {
        clothing = '厚冬装（加厚羽绒服、保暖内衣、厚棉裤）';
        accessories.push('厚围巾', '厚手套', '保暖帽', '保暖鞋');
      }
      
      // 根据天气状况调整建议
      if (textDay.includes('雨') || textNight.includes('雨')) {
        accessories.push('雨伞', '雨衣');
        clothing += '，建议选择防水材质';
      }
      
      if (textDay.includes('雪') || textNight.includes('雪')) {
        accessories.push('防滑鞋', '保暖手套');
        clothing += '，注意防滑保暖';
      }
      
      if (windScaleDay >= 5) {
        accessories.push('防风外套');
        clothing += '，注意防风';
      }
      
      if (textDay.includes('晴') && avgTemp > 15) {
        accessories.push('防晒用品');
      }
      
      advice.daily.push({
        date: day.fxDate,
        temperature: `${tempMin}°C ~ ${tempMax}°C`,
        weather: `${textDay}转${textNight}`,
        wind: `${windScaleDay}级风`,
        clothingAdvice: clothing,
        accessories: accessories.length > 0 ? accessories.join('、') : '无特殊配件',
        comfortLevel: getComfortLevel(avgTemp, textDay, windScaleDay)
      });
    });
  }
  
  return advice;
}

// 计算舒适度等级
function getComfortLevel(temp, weather, wind) {
  let score = 0;
  
  // 温度评分（20-25°C为最舒适）
  if (temp >= 20 && temp <= 25) score += 3;
  else if (temp >= 15 && temp <= 28) score += 2;
  else if (temp >= 10 && temp <= 32) score += 1;
  
  // 天气状况评分
  if (weather.includes('晴')) score += 2;
  else if (weather.includes('多云')) score += 1;
  else if (weather.includes('雨') || weather.includes('雪')) score -= 1;
  
  // 风力评分
  if (wind <= 3) score += 1;
  else if (wind >= 6) score -= 1;
  
  if (score >= 4) return '非常舒适';
  else if (score >= 2) return '舒适';
  else if (score >= 0) return '一般';
  else return '不太舒适';
}

// 主函数
async function main() {
  try {
    // 获取城市位置ID
    const locationId = await getLocationId(city);
    
    // 获取天气数据
    const weatherData = await getWeather(locationId);
    
    // 生成穿衣建议
    const clothingAdvice = getClothingAdvice(weatherData);
    
    // 输出结果
    const result = {
      city: city,
      updateTime: weatherData.updateTime,
      days: days,
      weatherForecast: weatherData.daily,
      clothingAdvice: clothingAdvice
    };
    
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error(JSON.stringify({ 
      error: error.message,
      suggestion: '请检查城市名称是否正确，或稍后重试'
    }));
    process.exit(1);
  }
}

// 执行主函数
main();