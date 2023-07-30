import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

import fetch from 'node-fetch';



const tealhollow1Id = 52585950;
const itsthatspicymemeId = 134048903;



async function saveToFile(obj, fileName) {
    // let dataFromFile = JSON.parse(fs.readFileSync(`./${fileName}.json`, err => console.log(err)));

    fs.writeFile(`./${fileName}.json`, JSON.stringify(obj), (err) => {
        if (err) throw err;
    });
}

async function pullFromFile(fileName) {
    const rawData = fs.readFileSync(`./${fileName}.json`, (error, data) => {
        if (error) throw error;
        console.log(data);
    });

    return JSON.parse(rawData);
}

async function getOAuthToken() {
    // Get OAuth2 token  for session
    const oauthURL = `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_APP_CLIENT_ID}&client_secret=${process.env.TWITCH_APP_CLIENT_SECRET}&grant_type=client_credentials`;

    return await fetch(oauthURL, { method: 'POST' }).then(async res => {return await res.json()});
}

async function getStatusOfIfStreamerIsLiveOrNot(authorization, streamerId) {
    return await fetch(`https://api.twitch.tv/helix/streams?user_id=${streamerId}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${authorization}`,
            'Client-Id': process.env.TWITCH_APP_CLIENT_ID
        }
    })
    .then(async res => {
        const info = await res.json();

        if (info.data.length <= 0) {
            return { type: 'offline' };
        } else {
            return info.data[0];
        }
    })
    .catch(async (err) => {
        console.log(err);
        return null;
    });
}

async function getCurrentDayRange() {
    const date = new Date();
    
    const startOfDay = new Date(Math.trunc(date.getTime() / 86400000) * 86400000);

    const endOfDay = new Date((Math.trunc(date.getTime() / 86400000) * 86400000) + 86400000);

    return { startOfDay, endOfDay };
}


(async function main() {
    // Get day range
    const dayRange = await getCurrentDayRange();


    // Get OAuth token
    const token = await getOAuthToken();


    // Get chart in JSON format from file
    let chart = { data: [] };

    let chartDataFileName = 'chartData';

    try {
        let rawChartData = await pullFromFile(chartDataFileName);

        try { rawChartData.data.length; }
        catch {
            rawChartData.data = [];
        }
        
        chart = rawChartData;
    } catch (err) {
        console.log(err);

        await saveToFile(JSON.stringify({}), chartDataFileName);

        chart.data = [{
            live: false,
            day: dayRange.startOfDay.getTime()
        }];
    }


    // Dummy create placeholder offline whatever at start of each day
    if (chart.data[chart.data.length - 1].day < dayRange.startOfDay.getTime()) {
        chart.data.push({
            live: false,
            day: dayRange.startOfDay.getTime()
        });
    }


    // Get status of streamer
    const status = await getStatusOfIfStreamerIsLiveOrNot(token.access_token, itsthatspicymemeId);

    // Checks for what to keep in the database or not
    if (status.type === 'live') {
        console.log(`[${Date()}] Check says:  \tLive!`);

        if (Date.parse(status.started_at) >= dayRange.endOfDay.getTime()) {
            console.log('Something freaky is going on...  stream start date is in the future!');
        }
        else if (Date.parse(status.started_at) >= dayRange.startOfDay.getTime()) {
            chart.data[chart.data.length - 1] = {
                live: true,
                day: dayRange.startOfDay.getTime(),
                info: status
            };
        }
    } else if (status.type === 'offline') {
        console.log(`[${Date()}] Check says:  \tOffline!`);
    } else {
        console.log(`[${Date()}] Error during check of status!`);
    }

    saveToFile(chart, chartDataFileName);

    console.log(chart);


    setTimeout(main, 3000);
})();