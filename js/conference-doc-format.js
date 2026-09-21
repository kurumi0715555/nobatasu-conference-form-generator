// 保護者向け文書の共通処理（時候の挨拶・和暦の日付）。
// フォーム作成・案内印刷・日程決定のすべてのページから使うため、独立したファイルにしている。
(function () {
    'use strict';

    // 月と上旬/中旬/下旬から時候の挨拶を選ぶ。[上旬, 中旬, 下旬]
    const SEASONAL_PHRASES = {
        1: ['新春の候', '厳寒の候', '厳寒の候'],
        2: ['晩冬の候', '余寒の候', '向春の候'],
        3: ['早春の候', '春暖の候', '春分の候'],
        4: ['陽春の候', '春暖の候', '晩春の候'],
        5: ['新緑の候', '薫風の候', '初夏の候'],
        6: ['初夏の候', '梅雨の候', '向暑の候'],
        7: ['盛夏の候', '盛夏の候', '猛暑の候'],
        8: ['残暑の候', '残暑の候', '晩夏の候'],
        9: ['初秋の候', '新涼の候', '秋涼の候'],
        10: ['秋冷の候', '仲秋の候', '紅葉の候'],
        11: ['晩秋の候', '向寒の候', '初霜の候'],
        12: ['初冬の候', '師走の候', '寒冷の候']
    };

    // 保護者向け文書に共通の書き出し。時候の挨拶に続けて使う。
    const GREETING_LEAD = '保護者の皆様にはますますご健勝のこととお喜び申し上げます。日頃より本校の教育活動にご理解とご協力をいただき、ありがとうございます。';

    // 'YYYY-MM-DD' から時候の挨拶を返す。日付が読めないときは空文字。
    function seasonalPhrase(dateString) {
        const matched = String(dateString || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!matched) return '';
        const phrases = SEASONAL_PHRASES[Number(matched[2])];
        if (!phrases) return '';
        const day = Number(matched[3]);
        return phrases[day <= 10 ? 0 : day <= 20 ? 1 : 2];
    }

    // 時候の挨拶と書き出しをつなげた1文を返す。日付が読めないときは書き出しだけ。
    function opening(dateString) {
        const phrase = seasonalPhrase(dateString);
        return phrase ? `${phrase}、${GREETING_LEAD}` : GREETING_LEAD;
    }

    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

    // 元号の開始日と、和暦年を出すための基準年（西暦 - baseYear = 和暦年）
    const ERAS = [
        { name: '令和', startKey: 20190501, baseYear: 2018 },
        { name: '平成', startKey: 19890108, baseYear: 1988 },
        { name: '昭和', startKey: 19261225, baseYear: 1925 }
    ];

    // 'YYYY-MM-DD' を「令和8年8月25日」にする。withWeekday を付けると曜日も出す。
    // Intl の和暦は「令和8/8/25」形式で元年にも対応しないため、自前で組み立てている。
    function eraDate(dateString, withWeekday) {
        const matched = String(dateString || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!matched) return '';
        const year = Number(matched[1]);
        const month = Number(matched[2]);
        const day = Number(matched[3]);
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            return String(dateString);
        }
        const key = year * 10000 + month * 100 + day;
        const era = ERAS.find(item => key >= item.startKey);
        const eraYear = era ? year - era.baseYear : 0;
        const head = era ? `${era.name}${eraYear === 1 ? '元' : eraYear}` : String(year);
        const base = `${head}年${month}月${day}日`;
        return withWeekday ? `${base}（${WEEKDAYS[date.getDay()]}）` : base;
    }

    window.ConferenceDocFormat = { seasonalPhrase, opening, eraDate, GREETING_LEAD };
})();
