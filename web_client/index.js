import {Dom} from "./Dom.js";

const Papa = window.Papa;

const escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");

/** @see https://stackoverflow.com/a/39460727/2750743 */
function base64ToHex(str) {
    const raw = atob(str);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
        const hex = raw.charCodeAt(i).toString(16);
        result += (hex.length === 2 ? hex : '0' + hex);
    }
    return result.toUpperCase();
}

/** @param {RegExp} reg */
const getRegexIterator = function*(superstring, reg) {
    let match;
    const statefulRegex = new RegExp(reg);
    while (match = statefulRegex.exec(superstring)) {
        yield match.index;
    }
}

const parseRowAt = (csvText, index) => {
    const prevBr = csvText.lastIndexOf('\n', index);
    const start = prevBr === -1 ? 0 : prevBr + 1;
    const nextBr = csvText.indexOf('\n', index);
    const end = nextBr === -1 ? csvText.length : nextBr;

    const line = csvText.slice(start, end);
    if (line.trim() === '') {
        return null;
    }

    const parsed = Papa.parse(line, {delimiter: ';'});
    const valuesTuple = parsed.data[0];

    return valuesTuple;
};

const gui = {
    status_panel: document.getElementById('status_panel'),
    searchForm: document.forms[0],
    matched_entries_list: document.getElementById('matched_entries_list'),
    responsive_entries_list: document.getElementById('responsive_entries_list'),
    video_player_popdown: document.getElementById('video_player_popdown'),
    selected_video_container_info: document.getElementById('selected_video_container_info'),
    selected_video_stream_list: document.getElementById('selected_video_stream_list'),
    selected_video_ffmpeg_info: document.getElementById('selected_video_ffmpeg_info'),
    selected_video_filename: document.getElementById('selected_video_filename'),
    selected_video_size: document.getElementById('selected_video_size'),
};

let bytesLoaded = 0;
const csvFetchStartMs = Date.now();
const trackBytesLoaded = rs => {
    const reader = rs.body.getReader();
    const stream = new ReadableStream({
        start(controller) {
            const pump = () => {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        controller.close();
                    } else {
                        bytesLoaded += value.length;
                        gui.status_panel.textContent = 'Bytes Loaded: ' + (bytesLoaded / 1024 / 1024).toFixed(3) + ' MiB / ~200 MiB in ' + (Date.now() - csvFetchStartMs) + ' ms';
                        controller.enqueue(value);
                        return pump();
                    }
                });
            };
            return pump();
        },
    });
    return new Response(stream);
};

const OFFENSIVE_REGEXES = [
    'fuck', 'fucks', 'fucked', 'fucker', 'cum', 'cums', 'nude', 'nudes', 'pussy', 'pussies', 'playboy', 'sex', 'XXX', 'anal', 'rape', 'raped', 'rapes',
    'glory hole', 'gloryhole', 'porn', 'porns', 'uncensored', 'penis', 'penises', 'dick', 'dicks', 'cock', 'dildo', 'erotic', 'hentai', 'xxx', "adult",   'porn', 'xxx', 'adult', 'erotic', 'sex', 'nude', 'naked', 'explicit', 'uncensored', 'hentai', 'milf', 'anal', 'blowjob', 'orgy', 'gangbang', 'creampie', 'cumshot', 'hardcore', 'fetish', 'bdsm', 'bondage', 'kinky', 'swingers', 'swinger', 'swapping', 'interracial', 'cuckold', 'cuck', 'hotwife', 'amateur', 'homemade', 'casting', 'parody', 'lesbian', 'gay', 'bisexual', 'transgender', 'shemale', 'ladyboy', 'fisting', 'pissing', 'scat', 'watersports', 'golden', 'facial', 'bukkake', 'gangbang', 'dp', 'doublepenetration', 'threesome', 'foursome', 'orgy', 'groupsex', 'swinger', 'wife', 'cheating', 'cuckold', 'hotwife', 'sharing', 'swingers', 'taboo', 'incest', 'family', 'step', 'milf', 'cougar', 'mature', 'granny', 'gilf', 'teen', 'young', 'barely', 'legal', 'lolita', 'schoolgirl', 'cheerleader', 'babysitter', 'nurse', 'maid', 'secretary', 'teacher', 'student', 'coed', 'stripper', 'prostitute', 'escort', 'camgirl', 'webcam', 'livecam', 'pornstar', 'brazzers', 'naughtyamerica', 'bangbros', 'realitykings', 'tiny4k', 'cum', 'jizz', 'load', 'creampie', 'facial', 'tits', 'boobs', 'breasts', 'nipples', 'pussy', 'vagina', 'cunt', 'dick', 'cock', 'penis', 'balls', 'testicles', 'asshole', 'anus', 'butthole', 'fart', 'poop', 'scat', 'fisting', 'prolapse', 'gape', 'spread', 'extreme', 'bizarre', 'nasty', 'dirty', 'kinky', 'fetish', 'bdsm', 'bondage', 'domination', 'submission', 'slave', 'master', 'mistress', 'sadism', 'masochism', 'spanking', 'whipping', 'torture', 'electro', 'needle', 'piercing', 'cutting', 'blood', 'gore', 'snuff', 'rape', 'forced', 'brutal', 'extreme', 'bizarre', 'nasty', 'dirty', 'kinky', 'fetish'
].flatMap(word => {
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
    const anyCaseRegex = new RegExp('\\b' + escapeRegex(word) + '\\b', 'i');
    const capitalizedRegex = new RegExp('([a-z0-9_]|\\b)' + escapeRegex(capitalized) + '([A-Z0-9_]|\\b)');
    return [anyCaseRegex, capitalizedRegex];
});

const isOffensive = (torrentName) => {
    return OFFENSIVE_REGEXES.some(regex => torrentName.match(regex));
};

gui.status_panel.textContent = 'Retrieving CSV (~200 MiB)...\n';

const urlToCsvTextPromise = url => fetch(url)
    .then(trackBytesLoaded)
    .then(rs => rs.text());

const halfPromise = urlToCsvTextPromise('./../piratebay_db_dump_2015_10_27T04_10_50_to_2019_09_14T22_09_31.csv');
const secondPromise = halfPromise.then(() => urlToCsvTextPromise('./../piratebay_db_dump_2004_03_25T22_03_00_to_2015_10_27T04_10_22.csv'));

const csvTextPromises = [
    urlToCsvTextPromise('./../random_torrent_contributions.csv'),
    halfPromise,
    secondPromise,
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_2.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_8.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_9.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_10.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_11.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_18.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_19.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_20.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_22.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_23.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_24.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_25.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_26.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_28.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_29.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_31.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_33.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_34.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_35.csv',)),
    secondPromise.then(() => urlToCsvTextPromise('./../rutracker_2020_09_27/category_37.csv',)),
];

const fetchedCsvTexts = [];
csvTextPromises.forEach(promise => promise.then(csvText => {
    document.body.classList.toggle('results-outdated', true);
    fetchedCsvTexts.push(csvText);
}));

const findRecordsByRegex = function*({csvText, regex}) {
    const colsBr = csvText.indexOf('\n');
    const indexesIter = getRegexIterator(csvText, regex);

    for (const index of indexesIter) {
        const valuesTuple = parseRowAt(csvText, index + 1);
        if (!valuesTuple) {
            continue; // empty lines in CSV, trailing line break for example
        }
        if (index < colsBr) {
            continue; // column headers matched the pattern
        }
        const [addedDt, infohashBase64, name, size] = valuesTuple;
        const infoHash = base64ToHex(infohashBase64);
        yield {addedDt, infoHash, name, size};
    }
};

const makeTorrentTr = (record) => {
    const {addedDt, infoHash, name, size} = record;
    const statusHolder = Dom('div', {
        class: 'status-holder',
        style: 'font-size: 12px',
    });

    return Dom('tr', {
        class: 'torrent-item-row',
        'data-info-hash': infoHash,
    }, [
        Dom('td', {'data-name': 'addedDt'}, addedDt),
        Dom('td', {'data-name': 'infohash'}, [
            Dom('a', {'href': 'magnet:?xt=urn:btih:' + infoHash}, [
                Dom('span', {}, '(magnet link) '),
            ]),
            Dom('a', {'href': '/player.html?t=magnet:?xt=urn:btih:' + infoHash}, [
                Dom('span', {'class': 'info-hash-text'}, "(stream) "),
            ]),
            Dom('a', {
                'href': '/dl.html?magnet:?xt=urn:btih:' + infoHash,
            }, [
                Dom('span', {}, '(download as zip)'),
            ])
        ]),
        // would be nice to highlight the part of text that was matched
        Dom('td', {'data-name': 'name'}, name.split(/ \/ /).join(' /\n ')),
        Dom('td', {'data-name': 'size'}, (size / 1024 / 1024).toFixed(3) + ' MiB'),
        Dom('td', {'data-name': 'status'}, [statusHolder]),
    ]);

}