(function () {
    'use strict';

    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
    const DEFAULT_TITLE = '三者懇談 日程希望調査';
    const RESPONSE_MODES = {
        checked_unavailable: {
            label: '参加できない日時を選ぶ',
            description: [
                '三者懇談の希望調査フォームです。回答は5分ほどで終わります。',
                '',
                'はじめに、お子さまの学級・出席番号・氏名を入力してください。',
                'きょうだいが本校に在籍している場合は、続けて同じフォームでまとめて回答できます。',
                '',
                '日時の質問では、「参加できない時間」だけにチェックを入れてください。',
                'チェックのなかった時間の中から、学校で日程を組みます。',
                '',
                '決定した日時は、後日プリントでお知らせします。'
            ].join('\n'),
            sectionTitle: '参加できない日時',
            sectionHelp: '参加できない日時だけにチェックしてください。チェックしていない日時は参加可能として扱います。',
            questionPrefix: '参加できない日時',
            questionHelp: 'この日に参加できない時間をすべて選択してください。すべて参加できる場合は何も選択しません。',
            confirmation: 'チェックしていない日時は参加可能であることを確認しました',
            hint: '保護者は参加できない日時だけにチェックします。未チェックの日時は参加可能として扱います。'
        },
        checked_available: {
            label: '参加できる日時を選ぶ',
            description: [
                '三者懇談の希望調査フォームです。回答は5分ほどで終わります。',
                '',
                'はじめに、お子さまの学級・出席番号・氏名を入力してください。',
                'きょうだいが本校に在籍している場合は、続けて同じフォームでまとめて回答できます。',
                '',
                '日時の質問では、「参加できる時間」だけにチェックを入れてください。',
                'チェックのあった時間の中から、学校で日程を組みます。',
                '',
                '決定した日時は、後日プリントでお知らせします。'
            ].join('\n'),
            sectionTitle: '参加できる日時',
            sectionHelp: '参加できる日時だけにチェックしてください。チェックしていない日時は参加不可として扱います。',
            questionPrefix: '参加できる日時',
            questionHelp: 'この日に参加できる時間をすべて選択してください。選択した時間だけを参加可能として扱います。',
            confirmation: '選択した日時だけが参加可能として扱われることを確認しました',
            hint: '保護者は参加できる日時だけにチェックします。未チェックの日時は参加不可として扱います。'
        }
    };
    const DEFAULT_DESCRIPTION = RESPONSE_MODES.checked_unavailable.description;
    const DEFAULT_NOTICE_TITLE = '三者懇談 日時のお知らせ';
    const DEFAULT_NOTICE_MESSAGE = '三者懇談の日時が下記のとおり決まりましたので、お知らせいたします。お子さまの学校での様子をお伝えするとともに、ご家庭での様子もお聞かせいただければ幸いです。ご多用のところ恐れ入りますが、ご来校くださいますようお願いいたします。';
    const DEFAULT_NOTICE_NOTE = [
        '・当日は受付はありません。時間になりましたら、教室へ直接お越しください。',
        '・前のご家庭の状況により、開始時刻が多少前後することがあります。',
        '・ご都合が悪くなった場合は、お手数ですが担任までご連絡ください。',
        '・上履きをご持参ください。'
    ].join('\n');
    const SCHOOL_SETTINGS_KEY = 'conferenceSchoolSettings';

    // 配布予定日から自動生成した決定通知の本文。手で書き換えられたかの判定に使う。
    let autoNoticeMessage = '';

    // 時候の挨拶（doc-format.js・3ページ共通）＋定型の書き出し＋本文。
    function buildNoticeMessage(deliveryDate) {
        return `${window.ConferenceDocFormat.opening(deliveryDate)}\n\nさて、${DEFAULT_NOTICE_MESSAGE}`;
    }

    // 自動生成した文のままなら入れ替える。手で直していれば触らない。
    function applyNoticeMessage() {
        const next = buildNoticeMessage(elements.noticeDeliveryDate.value);
        const current = elements.noticeMessage.value.trim();
        if (current === '' || current === autoNoticeMessage.trim() || current === DEFAULT_NOTICE_MESSAGE.trim()) {
            elements.noticeMessage.value = next;
        }
        autoNoticeMessage = next;
    }

    const elements = {};
    let scheduleRowId = 0;
    let schoolRoster = [];

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindEvents();
        updateRemarkFieldsState();
        elements.noticeDeliveryDate.value = formatInputDate(new Date());
        applyNoticeMessage();
        addScheduleRow();
        setDefaultDeadline();
        saveSchoolSettings();
    }

    function cacheElements() {
        elements.formTitle = document.getElementById('formTitle');
        elements.formDescription = document.getElementById('formDescription');
        elements.classes = document.getElementById('classes');
        elements.responseDeadline = document.getElementById('responseDeadline');
        elements.responseMode = document.getElementById('responseMode');
        elements.responseModeHint = document.getElementById('responseModeHint');
        elements.remarkEnabled = document.getElementById('remarkEnabled');
        elements.remarkFields = document.getElementById('remarkFields');
        elements.remarkTitle = document.getElementById('remarkTitle');
        elements.remarkHelpText = document.getElementById('remarkHelpText');
        elements.schoolName = document.getElementById('schoolName');
        elements.principalName = document.getElementById('principalName');
        elements.classCount1 = document.getElementById('classCount1');
        elements.classCount2 = document.getElementById('classCount2');
        elements.classCount3 = document.getElementById('classCount3');
        elements.maxAttendanceNumber = document.getElementById('maxAttendanceNumber');
        elements.supportClasses = document.getElementById('supportClasses');
        elements.downloadInitialRosterBtn = document.getElementById('downloadInitialRosterBtn');
        elements.initialRosterFile = document.getElementById('initialRosterFile');
        elements.initialRosterStatus = document.getElementById('initialRosterStatus');
        elements.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        elements.loadSettingsBtn = document.getElementById('loadSettingsBtn');
        elements.settingsFileStatus = document.getElementById('settingsFileStatus');
        elements.noticeTitle = document.getElementById('noticeTitle');
        elements.noticeDeliveryDate = document.getElementById('noticeDeliveryDate');
        elements.noticePlace = document.getElementById('noticePlace');
        elements.noticeMessage = document.getElementById('noticeMessage');
        elements.noticeNote = document.getElementById('noticeNote');
        elements.slotDuration = document.getElementById('slotDuration');
        elements.scheduleList = document.getElementById('scheduleList');
        elements.scheduleTemplate = document.getElementById('scheduleRowTemplate');
        elements.addScheduleBtn = document.getElementById('addScheduleBtn');
        elements.generateBtn = document.getElementById('generateBtn');
        elements.resetBtn = document.getElementById('resetBtn');
        elements.errorMessage = document.getElementById('errorMessage');
        elements.resultArea = document.getElementById('resultArea');
        elements.resultSummary = document.getElementById('resultSummary');
        elements.gasOutput = document.getElementById('gasOutput');
        elements.copyBtn = document.getElementById('copyBtn');
        elements.copyStatus = document.getElementById('copyStatus');
        elements.resetConfirmBanner = document.getElementById('resetConfirmBanner');
        elements.resetConfirmBtn = document.getElementById('resetConfirmBtn');
        elements.resetCancelBtn = document.getElementById('resetCancelBtn');
    }

    function bindEvents() {
        elements.addScheduleBtn.addEventListener('click', () => addScheduleRow(inheritedScheduleValues()));
        elements.generateBtn.addEventListener('click', handleGenerate);
        elements.resetBtn.addEventListener('click', showResetConfirm);
        elements.copyBtn.addEventListener('click', copyGeneratedCode);
        elements.slotDuration.addEventListener('change', updateAllPreviews);
        elements.responseMode.addEventListener('change', handleResponseModeChange);
        elements.noticeDeliveryDate.addEventListener('change', applyNoticeMessage);
        elements.remarkEnabled.addEventListener('change', updateRemarkFieldsState);
        elements.downloadInitialRosterBtn.addEventListener('click', downloadRosterTemplate);
        elements.initialRosterFile.addEventListener('change', loadInitialRosterFile);
        elements.saveSettingsBtn.addEventListener('click', saveSettingsJson);
        elements.loadSettingsBtn.addEventListener('click', loadSettingsJson);
        [elements.schoolName, elements.principalName, elements.responseDeadline]
            .forEach(input => input.addEventListener('input', saveSchoolSettings));
        const initialRosterTrigger = document.querySelector('label[for="initialRosterFile"]');
        if (initialRosterTrigger) {
            initialRosterTrigger.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                elements.initialRosterFile.click();
            });
        }
        elements.resetConfirmBtn.addEventListener('click', () => {
            hideResetConfirm();
            resetForm();
        });
        elements.resetCancelBtn.addEventListener('click', hideResetConfirm);

        elements.scheduleList.addEventListener('input', event => {
            const card = event.target.closest('.schedule-card');
            if (!card) return;
            updateSchedulePreview(card);
            saveSchoolSettings();
        });

        elements.scheduleList.addEventListener('click', event => {
            const removeButton = event.target.closest('.remove-schedule');
            if (!removeButton) return;
            const cards = elements.scheduleList.querySelectorAll('.schedule-card');
            if (cards.length === 1) {
                showError([{ message: '懇談日を1日以上設定してください。', fieldId: 'scheduleList' }]);
                return;
            }
            removeButton.closest('.schedule-card').remove();
            renumberScheduleRows();
            saveSchoolSettings();
            hideError();
        });
    }

    function readRosterShape() {
        const classes = [];
        [1, 2, 3].forEach(grade => {
            const count = clampInteger(elements['classCount' + grade].value, 0, 20, 0);
            for (let classNo = 1; classNo <= count; classNo += 1) {
                classes.push({ grade, classNo, className: `${grade}年${classNo}組` });
            }
        });
        // 特別支援学級など「◯年◯組」で表せない学級。学年・クラス番号は持たない。
        elements.supportClasses.value.split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .forEach(className => {
                if (classes.some(item => item.className === className)) return;
                classes.push({ grade: null, classNo: null, className });
            });
        if (classes.length === 0) {
            throw new Error('学級数を1つ以上にするか、特別支援学級名を入力してください。');
        }
        return {
            classes,
            maxNumber: clampInteger(elements.maxAttendanceNumber.value, 1, 99, 40)
        };
    }

    function clampInteger(value, min, max, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(min, Math.min(max, Math.trunc(parsed)));
    }

    async function downloadRosterTemplate() {
        hideError();
        try {
            if (!window.ExcelJS) {
                throw new Error('Excel作成ライブラリを読み込めませんでした。ページを再読み込みしてください。');
            }
            const shape = readRosterShape();
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'NOBATASU Tools 三者懇談サポート';
            const sheet = workbook.addWorksheet('名簿');
            // 縦＝出席番号・横＝学級のマトリクス型。見出しはツール側で書くので手入力は氏名だけになる。
            sheet.columns = [
                { header: '出席番号', key: 'number', width: 10 },
                ...shape.classes.map(item => ({ header: item.className, key: item.className, width: 16 }))
            ];
            for (let number = 1; number <= shape.maxNumber; number += 1) {
                sheet.addRow([number]);
            }
            sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
            styleWorkbookHeader(sheet);
            const buffer = await workbook.xlsx.writeBuffer();
            triggerDownload(
                new Blob([buffer], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }),
                '三者懇談_全校名簿テンプレート.xlsx'
            );
            showInitialRosterStatus(`${shape.classes.length}学級・出席番号${shape.maxNumber}番までのテンプレートをダウンロードしました。学級の列に氏名を入力してください。`);
        } catch (error) {
            showError([{ message: error.message, fieldId: 'initialRosterFile' }]);
        }
    }

    function readSettingsForJson() {
        return {
            version: 1,
            schoolName: elements.schoolName.value.trim(),
            principalName: elements.principalName.value.trim(),
            formTitle: elements.formTitle.value.trim(),
            formDescription: elements.formDescription.value.trim(),
            responseMode: elements.responseMode.value,
            remarkSettings: {
                enabled: elements.remarkEnabled.checked,
                title: elements.remarkTitle.value.trim(),
                helpText: elements.remarkHelpText.value.trim()
            },
            documentSettings: {
                noticeTitle: elements.noticeTitle.value.trim(),
                noticeDeliveryDate: elements.noticeDeliveryDate.value,
                noticePlace: elements.noticePlace.value.trim(),
                noticeMessage: elements.noticeMessage.value.trim(),
                noticeNote: elements.noticeNote.value.trim()
            },
            durationMinutes: Number(elements.slotDuration.value)
        };
    }

    function saveSettingsJson() {
        hideError();
        const blob = new Blob([JSON.stringify(readSettingsForJson(), null, 2)], { type: 'application/json' });
        triggerDownload(blob, '三者懇談_設定.json');
        elements.settingsFileStatus.textContent = '設定を保存しました。名簿と懇談日時は含まれていません。';
    }

    function loadSettingsJson() {
        hideError();
        elements.settingsFileStatus.textContent = '';
        document.getElementById('settingsFilePicker')?.remove();

        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = 'application/json,.json';
        picker.id = 'settingsFilePicker';
        picker.hidden = true;
        document.body.appendChild(picker);

        const cleanup = () => picker.remove();
        picker.addEventListener('cancel', cleanup);
        picker.addEventListener('change', () => {
            const file = picker.files && picker.files[0];
            if (!file) {
                cleanup();
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    let parsedData;
                    try {
                        parsedData = JSON.parse(String(reader.result));
                    } catch (error) {
                        throw new Error('JSONとして読み取れませんでした。保存した設定JSONを選択してください。');
                    }
                    const settings = normalizeSettingsJson(parsedData);
                    if (!window.confirm(`現在の学校・フォーム・文書の設定を「${file.name}」の内容に置き換えます。\n名簿と懇談日時は変更されません。よろしいですか？`)) return;
                    applySettingsFromJson(settings);
                    elements.settingsFileStatus.textContent = '設定を読み込みました。名簿と懇談日時はそのままです。';
                } catch (error) {
                    showError([{ message: error.message, fieldId: 'loadSettingsBtn' }]);
                } finally {
                    cleanup();
                }
            };
            reader.onerror = () => {
                showError([{ message: '設定JSONを読み取れませんでした。ファイルを確認してください。', fieldId: 'loadSettingsBtn' }]);
                cleanup();
            };
            reader.readAsText(file);
        });
        picker.click();
    }

    function normalizeSettingsJson(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('設定JSONの形式が正しくありません。');
        }

        const remarkSettings = data.remarkSettings;
        const documentSettings = data.documentSettings;
        const textFields = [data.schoolName, data.principalName, data.formTitle, data.formDescription];
        const documentFields = documentSettings && [
            documentSettings.noticePlace,
            documentSettings.noticeMessage,
            documentSettings.noticeNote
        ];
        const durationMinutes = Number(data.durationMinutes);

        if (
            textFields.some(value => typeof value !== 'string')
            || !['checked_unavailable', 'checked_available'].includes(data.responseMode)
            || !remarkSettings
            || typeof remarkSettings.enabled !== 'boolean'
            || typeof remarkSettings.title !== 'string'
            || typeof remarkSettings.helpText !== 'string'
            || !documentFields
            || documentFields.some(value => typeof value !== 'string')
            || ![10, 15, 20, 30].includes(durationMinutes)
        ) {
            throw new Error('このツールで保存した設定JSONではないようです。');
        }

        return {
            schoolName: data.schoolName,
            principalName: data.principalName,
            formTitle: data.formTitle,
            formDescription: data.formDescription,
            responseMode: data.responseMode,
            remarkSettings: {
                enabled: remarkSettings.enabled,
                title: remarkSettings.title,
                helpText: remarkSettings.helpText
            },
            documentSettings: {
                // noticeTitle は後から追加した項目。旧バージョンの設定JSONには含まれないので既定値で補う。
                noticeTitle: typeof documentSettings.noticeTitle === 'string' && documentSettings.noticeTitle.trim()
                    ? documentSettings.noticeTitle
                    : DEFAULT_NOTICE_TITLE,
                // 配布予定日も後から追加した項目。旧バージョンの設定JSONには含まれない。
                noticeDeliveryDate: /^\d{4}-\d{2}-\d{2}$/.test(documentSettings.noticeDeliveryDate || '')
                    ? documentSettings.noticeDeliveryDate
                    : '',
                noticePlace: documentSettings.noticePlace,
                noticeMessage: documentSettings.noticeMessage,
                noticeNote: documentSettings.noticeNote
            },
            durationMinutes
        };
    }

    function applySettingsFromJson(settings) {
        elements.schoolName.value = settings.schoolName;
        elements.principalName.value = settings.principalName;
        elements.formTitle.value = settings.formTitle;
        elements.formDescription.value = settings.formDescription;
        elements.responseMode.value = settings.responseMode;
        elements.responseModeHint.textContent = getResponseModeLabels(settings.responseMode).hint;
        elements.remarkEnabled.checked = settings.remarkSettings.enabled;
        elements.remarkTitle.value = settings.remarkSettings.title;
        elements.remarkHelpText.value = settings.remarkSettings.helpText;
        elements.noticeTitle.value = settings.documentSettings.noticeTitle;
        elements.noticeDeliveryDate.value = settings.documentSettings.noticeDeliveryDate || formatInputDate(new Date());
        elements.noticePlace.value = settings.documentSettings.noticePlace;
        elements.noticeMessage.value = settings.documentSettings.noticeMessage;
        elements.noticeNote.value = settings.documentSettings.noticeNote;
        elements.slotDuration.value = String(settings.durationMinutes);
        // 読み込んだ本文が「配布予定日からの自動生成文」と同じなら、以後も日付変更に追随させる。
        // これを怠ると、設定JSON読込後は時候の挨拶が永久に更新されなくなる。
        autoNoticeMessage = buildNoticeMessage(elements.noticeDeliveryDate.value);
        updateRemarkFieldsState();
        updateAllPreviews();
        saveSchoolSettings();
        elements.resultArea.hidden = true;
        elements.gasOutput.textContent = '';
        elements.copyStatus.textContent = '';
    }

    function updateRemarkFieldsState() {
        const enabled = elements.remarkEnabled.checked;
        elements.remarkFields.classList.toggle('is-disabled', !enabled);
        elements.remarkTitle.disabled = !enabled;
        elements.remarkHelpText.disabled = !enabled;
    }

    async function loadInitialRosterFile() {
        hideError();
        try {
            const file = elements.initialRosterFile.files[0];
            if (!file) return;
            if (!window.ExcelJS) {
                throw new Error('Excel読込ライブラリを読み込めませんでした。ページを再読み込みしてください。');
            }
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const sheet = workbook.getWorksheet('名簿') || workbook.worksheets[0];
            if (!sheet) {
                throw new Error('名簿シートが見つかりません。名簿テンプレートを使ってください。');
            }

            schoolRoster = sortRoster(parseRosterWorksheet(sheet));
            if (schoolRoster.length === 0) {
                throw new Error('名簿を読み取れませんでした。1行目が「出席番号・1年1組・1年2組…」になっているか確認してください。');
            }
            const classes = classesFromRoster(schoolRoster);
            elements.classes.value = classes.join('\n');
            showInitialRosterStatus(`${file.name} から ${schoolRoster.length}名・${classes.length}学級を読み取りました。対象学級へ自動反映しました。`);
        } catch (error) {
            schoolRoster = [];
            elements.classes.value = '';
            showError([{ message: error.message, fieldId: 'initialRosterFile' }]);
        } finally {
            elements.initialRosterFile.value = '';
        }
    }

    function parseRosterWorksheet(sheet) {
        // A1が「出席番号」ならマトリクス型、「学年」なら旧テンプレートの縦持ち。
        const firstHeader = cellText(sheet.getRow(1).getCell(1).value);
        if (firstHeader.includes('出席番号') || firstHeader.includes('番号')) {
            return parseMatrixRosterWorksheet(sheet);
        }
        return parseColumnRosterWorksheet(sheet);
    }

    function parseMatrixRosterWorksheet(sheet) {
        const columns = [];
        const seen = new Set();
        const duplicates = [];
        sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
            if (colNumber === 1) return;
            const text = cellText(cell.value);
            if (!text) return;
            const parsed = parseClassHeader(text);
            if (seen.has(parsed.className)) {
                duplicates.push(parsed.className);
                return;
            }
            seen.add(parsed.className);
            columns.push({ colNumber, ...parsed });
        });

        if (duplicates.length > 0) {
            throw new Error(`1行目に同じ学級「${duplicates.join('」「')}」が複数あります。学級ごとに1列にしてください。`);
        }
        if (columns.length === 0) {
            throw new Error('学級の見出しが見つかりません。1行目のB列以降に学級名を入力してください。');
        }

        const rows = [];
        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;
            const number = normalizeNumber(cellText(row.getCell(1).value));
            if (!number) return;
            columns.forEach(column => {
                const name = cellText(row.getCell(column.colNumber).value).replace(/\s+/g, ' ');
                if (!name) return;
                rows.push({
                    grade: column.grade,
                    classNo: column.classNo,
                    className: column.className,
                    number,
                    name
                });
            });
        });
        return rows;
    }

    // 見出しを学級として解釈する。「1年1組」「1-1」「１年１組」は学年・クラス番号に分解して並べ替えに使い、
    // 「ひまわり組」のように分解できないものは学級名をそのまま採用する（区切りのない「11」も分解しない）。
    function parseClassHeader(text) {
        const className = String(text).trim().replace(/\s+/g, ' ');
        const normalized = className
            .replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
            .replace(/\s+/g, '');
        const match = normalized.match(/^(\d+)(?:年|[-ー－−/])(\d+)(?:組|クラス)?$/);
        const grade = match ? Number(match[1]) : 0;
        const classNo = match ? Number(match[2]) : 0;
        if (!grade || !classNo) {
            return { className, grade: '', classNo: '' };
        }
        // 表記ゆれ（1-1 など）はここで「1年1組」に正規化する。
        return { className: `${grade}年${classNo}組`, grade: String(grade), classNo: String(classNo) };
    }

    function cellText(value) {
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') {
            if (Array.isArray(value.richText)) {
                return value.richText.map(part => part.text || '').join('').trim();
            }
            if (value.result !== undefined) return String(value.result).trim();
            if (value.text !== undefined) return String(value.text).trim();
        }
        return String(value).trim();
    }

    function parseColumnRosterWorksheet(sheet) {
        const rows = [];
        const headers = [];
        let fullClassIndex = -1;
        let gradeIndex = -1;
        let classIndex = -1;
        let numberIndex = -1;
        let nameIndex = -1;

        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            const values = row.values.slice(1).map(value => {
                return String(value === undefined || value === null ? '' : value).trim();
            });
            if (rowNumber === 1) {
                values.forEach((value, index) => {
                    headers[index] = value;
                });
                fullClassIndex = findRosterHeader(headers, ['学級']);
                gradeIndex = findRosterHeader(headers, ['学年']);
                classIndex = findRosterHeader(headers, ['クラス', '組']);
                numberIndex = findRosterHeader(headers, ['出席番号', '番号']);
                nameIndex = findRosterHeader(headers, ['氏名', '生徒氏名', '名前']);
                return;
            }
            const number = normalizeNumber(values[numberIndex]);
            const name = String(values[nameIndex] || '').trim().replace(/\s+/g, ' ');
            if (!number || !name) return;

            // 「学級」列があればそれを優先。無ければ学年・クラスから組み立てる。
            if (fullClassIndex >= 0 && values[fullClassIndex]) {
                rows.push({ ...parseClassHeader(values[fullClassIndex]), number, name });
                return;
            }
            const grade = normalizeNumber(values[gradeIndex]);
            const classNo = normalizeNumber(values[classIndex]);
            if (!grade || !classNo) return;
            rows.push({
                grade,
                classNo,
                className: `${grade}年${classNo}組`,
                number,
                name
            });
        });
        return rows;
    }

    function findRosterHeader(headers, candidates) {
        return headers.findIndex(header => {
            return candidates.some(candidate => header.includes(candidate));
        });
    }

    // 「◯年◯組」は学年・クラス番号順、それ以外（特別支援学級など）は名前順で末尾にまとめる。
    function compareClassName(a, b) {
        const aParts = String(a).match(/^(\d+)年(\d+)組$/);
        const bParts = String(b).match(/^(\d+)年(\d+)組$/);
        if (aParts && bParts) {
            return Number(aParts[1]) - Number(bParts[1])
                || Number(aParts[2]) - Number(bParts[2]);
        }
        if (aParts) return -1;
        if (bParts) return 1;
        return String(a).localeCompare(String(b), 'ja');
    }

    // 名簿は学級昇順→出席番号昇順で並べる。マトリクス型は行（出席番号）優先で読むため、ここで並べ直す。
    function sortRoster(roster) {
        return roster.slice().sort((a, b) => {
            return compareClassName(a.className, b.className)
                || Number(a.number) - Number(b.number);
        });
    }

    function classesFromRoster(roster) {
        return [...new Set(roster.map(student => student.className))].sort(compareClassName);
    }

    function styleWorkbookHeader(sheet) {
        sheet.getRow(1).font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF006064' }
        };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    function showInitialRosterStatus(message) {
        elements.initialRosterStatus.hidden = false;
        elements.initialRosterStatus.textContent = message;
        elements.initialRosterStatus.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }

    function handleResponseModeChange() {
        const mode = elements.responseMode.value;
        const labels = getResponseModeLabels(mode);
        const currentDescription = elements.formDescription.value.trim();
        const defaultDescriptions = Object.values(RESPONSE_MODES).map(item => item.description);
        if (defaultDescriptions.includes(currentDescription)) {
            elements.formDescription.value = labels.description;
        }
        elements.responseModeHint.textContent = labels.hint;
    }

    function setDefaultDeadline() {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        elements.responseDeadline.value = formatInputDate(date);
    }

    // 「日程を追加」で引き継ぐ値。懇談は同じ時間帯を数日続けるのが普通なので、
    // 直前の行に入っている時刻をそのまま次の行の初期値にする。
    // 既定値（14:00等）を置くのとは別物で、これは本人がこの学校のために
    // 入力した値をそのまま続ける動きなので、気づかず誤った時刻を使う心配がない。
    // 日付だけは必ず変わるので引き継がない。
    function inheritedScheduleValues() {
        const cards = elements.scheduleList.querySelectorAll('.schedule-card');
        if (!cards.length) return {};
        const last = readScheduleCard(cards[cards.length - 1]);
        return {
            start: last.start,
            end: last.end,
            breakStart: last.breakStart,
            breakEnd: last.breakEnd
        };
    }

    function addScheduleRow(values = {}) {
        const fragment = elements.scheduleTemplate.content.cloneNode(true);
        const card = fragment.querySelector('.schedule-card');
        scheduleRowId += 1;

        const dateId = `scheduleDate${scheduleRowId}`;
        const startId = `scheduleStart${scheduleRowId}`;
        const endId = `scheduleEnd${scheduleRowId}`;
        const breakStartId = `scheduleBreakStart${scheduleRowId}`;
        const breakEndId = `scheduleBreakEnd${scheduleRowId}`;

        card.querySelector('.schedule-date').id = dateId;
        card.querySelector('.schedule-date-label').htmlFor = dateId;
        card.querySelector('.schedule-start').id = startId;
        card.querySelector('.schedule-start-label').htmlFor = startId;
        card.querySelector('.schedule-end').id = endId;
        card.querySelector('.schedule-end-label').htmlFor = endId;
        card.querySelector('.break-start').id = breakStartId;
        card.querySelector('.break-end').id = breakEndId;
        card.querySelector('.break-label').htmlFor = breakStartId;

        card.querySelector('.schedule-date').value = values.date || '';
        // 時刻は既定値を入れない。学校ごとに開始・終了が違うので、入っていると
        // そのまま気づかず使われる恐れがある（設定JSONから復元した値は尊重する）
        card.querySelector('.schedule-start').value = values.start || '';
        card.querySelector('.schedule-end').value = values.end || '';
        card.querySelector('.break-start').value = values.breakStart || '';
        card.querySelector('.break-end').value = values.breakEnd || '';

        elements.scheduleList.appendChild(fragment);
        renumberScheduleRows();
        updateSchedulePreview(elements.scheduleList.lastElementChild);
        saveSchoolSettings();
    }

    function renumberScheduleRows() {
        elements.scheduleList.querySelectorAll('.schedule-card').forEach((card, index) => {
            card.querySelector('.schedule-label').textContent = `日程 ${index + 1}`;
        });
    }

    function updateAllPreviews() {
        elements.scheduleList.querySelectorAll('.schedule-card').forEach(updateSchedulePreview);
    }

    function updateSchedulePreview(card) {
        const row = readScheduleCard(card);
        const preview = card.querySelector('.slot-preview');
        preview.classList.remove('is-valid', 'is-error');

        // まだ入力していないだけの状態は赤いエラーにしない（案内文のまま待つ）。
        // 時刻に既定値を入れていないので、日付だけ先に入れる操作は普通に起きる
        if (!row.date || !row.start || !row.end) {
            preview.innerHTML = '<i class="fas fa-clock" aria-hidden="true"></i> 日付と時間を入力すると、作成される時間枠を表示します。';
            return;
        }

        const result = createSlots(row, Number(elements.slotDuration.value));
        if (result.error) {
            preview.innerHTML = `<i class="fas fa-circle-exclamation" aria-hidden="true"></i> ${escapeHtml(result.error)}`;
            preview.classList.add('is-error');
            return;
        }

        const first = result.slots[0];
        const last = result.slots[result.slots.length - 1];
        preview.innerHTML = `<i class="fas fa-clock" aria-hidden="true"></i> ${result.slots.length}枠を作成：${escapeHtml(first)} 〜 ${escapeHtml(last)}`;
        preview.classList.add('is-valid');
    }

    function readScheduleCard(card) {
        return {
            date: card.querySelector('.schedule-date').value,
            start: card.querySelector('.schedule-start').value,
            end: card.querySelector('.schedule-end').value,
            breakStart: card.querySelector('.break-start').value,
            breakEnd: card.querySelector('.break-end').value
        };
    }

    function readFormData() {
        const classes = uniqueNonEmptyLines(elements.classes.value);
        const duration = Number(elements.slotDuration.value);
        const schedules = Array.from(
            elements.scheduleList.querySelectorAll('.schedule-card')
        ).map(readScheduleCard);

        return {
            title: elements.formTitle.value.trim(),
            description: elements.formDescription.value.trim(),
            classes,
            responseDeadline: elements.responseDeadline.value,
            responseMode: elements.responseMode.value,
            remarkSettings: {
                enabled: elements.remarkEnabled.checked,
                title: elements.remarkTitle.value.trim(),
                helpText: elements.remarkHelpText.value.trim()
            },
            documentSettings: {
                schoolName: elements.schoolName.value.trim(),
                principalName: elements.principalName.value.trim(),
                noticeTitle: elements.noticeTitle.value.trim(),
                noticeDeliveryDate: elements.noticeDeliveryDate.value,
                noticePlace: elements.noticePlace.value.trim(),
                noticeMessage: elements.noticeMessage.value.trim(),
                noticeNote: elements.noticeNote.value.trim()
            },
            roster: schoolRoster,
            duration,
            schedules
        };
    }

    function validateFormData(data) {
        const errors = [];
        if (!data.title) errors.push({ message: 'フォームのタイトルを入力してください。', fieldId: 'formTitle' });
        if (!data.description) errors.push({ message: '保護者への説明を入力してください。', fieldId: 'formDescription' });
        if (!data.documentSettings.schoolName) errors.push({ message: '学校名を入力してください。', fieldId: 'schoolName' });
        if (!data.documentSettings.principalName) errors.push({ message: '校長名を入力してください。', fieldId: 'principalName' });
        if (data.remarkSettings.enabled && !data.remarkSettings.title) {
            errors.push({ message: '備考欄を作る場合は、備考欄の見出しを入力してください。', fieldId: 'remarkTitle' });
        }
        if (data.remarkSettings.enabled && data.remarkSettings.title) {
            const reservedQuestionTitles = new Set([
                'タイムスタンプ',
                'Timestamp',
                '兄弟姉妹もまとめて入力しますか？',
                'さらに3人目も入力しますか？',
                '回答内容の確認'
            ]);
            for (let studentIndex = 1; studentIndex <= 3; studentIndex += 1) {
                const childPrefix = studentIndex === 1 ? 'お子さまの' : `${studentIndex}人目のお子さまの`;
                reservedQuestionTitles.add(`${childPrefix}学級`);
                reservedQuestionTitles.add(`${childPrefix}出席番号`);
                reservedQuestionTitles.add(`${childPrefix}氏名`);
                // 旧版の質問名。③が旧形式Excelを読む際の照合対象なので備考欄の見出しには使わせない。
                reservedQuestionTitles.add(`${studentIndex}人目_学級`);
                reservedQuestionTitles.add(`${studentIndex}人目_出席番号`);
                reservedQuestionTitles.add(`${studentIndex}人目_生徒氏名`);
            }
            data.schedules.forEach(schedule => {
                if (!schedule.date) return;
                reservedQuestionTitles.add(
                    `${getResponseModeLabels(data.responseMode).questionPrefix}（${formatJapaneseDate(schedule.date)}）`
                );
            });
            if (reservedQuestionTitles.has(data.remarkSettings.title)) {
                errors.push({ message: '備考欄の見出しが、フォーム内の別の質問と重複しています。別の見出しにしてください。', fieldId: 'remarkTitle' });
            }
        }
        if (data.roster.length === 0) {
            errors.push({ message: '最初に入力済みの全校名簿を読み込んでください。', fieldId: 'initialRosterFile' });
        }
        const rosterKeys = new Set();
        let hasDuplicateRosterKey = false;
        data.roster.forEach(student => {
            const key = `${student.className}|${Number(student.number)}`;
            if (rosterKeys.has(key)) hasDuplicateRosterKey = true;
            rosterKeys.add(key);
        });
        if (hasDuplicateRosterKey) {
            errors.push({ message: '名簿に同じ学級・出席番号の生徒が重複しています。名簿を修正して読み直してください。', fieldId: 'initialRosterFile' });
        }
        if (data.classes.length === 0) {
            errors.push({ message: '名簿から対象学級を読み取れませんでした。', fieldId: 'initialRosterFile' });
        }
        if (data.schedules.length === 0) {
            errors.push({ message: '懇談日を1日以上設定してください。', fieldId: 'scheduleList' });
        }

        const seenDates = new Set();
        data.schedules.forEach((schedule, index) => {
            const rowNumber = index + 1;
            const scheduleCard = elements.scheduleList.querySelectorAll('.schedule-card')[index];
            const dateFieldId = scheduleCard?.querySelector('.schedule-date')?.id || 'scheduleList';
            if (!schedule.date) {
                errors.push({ message: `日程 ${rowNumber} の日付を入力してください。`, fieldId: dateFieldId });
                return;
            }
            if (seenDates.has(schedule.date)) {
                errors.push({ message: `日程 ${rowNumber} の日付が重複しています。`, fieldId: dateFieldId });
            }
            seenDates.add(schedule.date);
            const result = createSlots(schedule, data.duration);
            if (result.error) errors.push({ message: `日程 ${rowNumber}：${result.error}`, fieldId: dateFieldId });
        });

        return errors;
    }

    function createSlots(schedule, duration) {
        const result = createSlotObjects(schedule, duration);
        return {
            error: result.error,
            slots: result.slots.map(slot => slot.display)
        };
    }

    function handleGenerate() {
        hideError();
        const data = readFormData();
        const errors = validateFormData(data);
        if (errors.length > 0) {
            showError(errors);
            return;
        }

        const preparedData = {
            title: data.title,
            description: appendDeadline(data.description, data.responseDeadline),
            classes: data.classes,
            responseMode: data.responseMode,
            responseLabels: getResponseModeLabels(data.responseMode),
            remarkSettings: data.remarkSettings,
            documentSettings: data.documentSettings,
            roster: data.roster,
            durationMinutes: data.duration,
            days: data.schedules
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(schedule => ({
                    date: schedule.date,
                    label: formatJapaneseDate(schedule.date),
                    slots: createSlotObjects(schedule, data.duration).slots
                }))
        };

        const gas = generateGas(preparedData);
        saveSchoolSettings();
        elements.gasOutput.textContent = gas;
        const totalSlots = preparedData.days.reduce((sum, day) => {
            return sum + day.slots.length;
        }, 0);
        elements.resultSummary.textContent = `${preparedData.roster.length}名・${preparedData.classes.length}学級・${preparedData.days.length}日間・合計${totalSlots}枠のフォームを作成します。回答方式：${preparedData.responseLabels.label}`;
        elements.resultArea.hidden = false;
        elements.copyStatus.textContent = '';
        elements.resultArea.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    function generateGas(config) {
        const serializedConfig = JSON.stringify(config, null, 2);
        return `/**
 * 三者懇談 日程希望調査フォームを作成します。
 * NOBATASU Tools「三者懇談サポート」で生成されたコードです。
 * 生成バージョン: 2026-08-11.1
 * このコードには名簿が含まれます。テスト回答の確認後はこのプロジェクトを削除してください。
 */
function createConferencePreferenceForm() {
  const config = ${serializedConfig};

  const form = FormApp.create(config.title);
  form.setDescription(config.description);
  form.setConfirmationMessage('ご回答ありがとうございました。送信内容を確認し、懇談日時は後日お知らせします。');
  form.setProgressBar(true);
  form.setCollectEmail(false);

  const spreadsheet = SpreadsheetApp.create(config.title + '（回答）');

  const numberValidation = createAttendanceNumberValidation();
  addStudentFields(form, config, 1, numberValidation);

  const siblingQuestion = form.addMultipleChoiceItem()
    .setTitle('兄弟姉妹もまとめて入力しますか？')
    .setHelpText('同じ家庭で三者懇談を受ける兄弟姉妹がいる場合は「はい」を選んでください。希望日時は家庭単位で1回だけ入力します。')
    .setRequired(true);

  const secondStudentPage = form.addPageBreakItem()
    .setTitle('2人目のお子さまについて');
  addStudentFields(form, config, 2, numberValidation);

  const thirdStudentQuestion = form.addMultipleChoiceItem()
    .setTitle('さらに3人目も入力しますか？')
    .setHelpText('3人目の兄弟姉妹がいる場合だけ「はい」を選んでください。')
    .setRequired(true);

  const thirdStudentPage = form.addPageBreakItem()
    .setTitle('3人目のお子さまについて');
  addStudentFields(form, config, 3, numberValidation);

  const schedulePage = form.addPageBreakItem()
    .setTitle(config.responseLabels.sectionTitle)
    .setHelpText(config.responseLabels.sectionHelp);

  config.days.forEach(function(day) {
    form.addCheckboxItem()
      .setTitle(config.responseLabels.questionPrefix + '（' + day.label + '）')
      .setHelpText(config.responseLabels.questionHelp)
      .setChoiceValues(day.slots.map(function(slot) {
        return slot.display;
      }));
  });

  form.addCheckboxItem()
    .setTitle('回答内容の確認')
    .setHelpText('この確認欄にチェックしてから送信してください。')
    .setChoiceValues([config.responseLabels.confirmation])
    .setRequired(true);

  if (config.remarkSettings && config.remarkSettings.enabled) {
    const remarkItem = form.addParagraphTextItem()
      .setTitle(config.remarkSettings.title || '備考');
    if (config.remarkSettings.helpText) {
      remarkItem.setHelpText(config.remarkSettings.helpText);
    }
  }

  siblingQuestion.setChoices([
    siblingQuestion.createChoice('はい', secondStudentPage),
    siblingQuestion.createChoice('いいえ', schedulePage)
  ]);

  thirdStudentQuestion.setChoices([
    thirdStudentQuestion.createChoice('はい', thirdStudentPage),
    thirdStudentQuestion.createChoice('いいえ', schedulePage)
  ]);

  // すべての質問を作成してから回答先を設定し、最終的な見出しを持つ
  // フォーム回答シートを確実に作成します。
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
  const responseSheet = prepareRawResponseSheet(spreadsheet, config);

  writeScheduleConditionSheet(spreadsheet, config);
  writeRosterSheet(spreadsheet, config.roster);
  writeSchoolSettingsSheet(spreadsheet, config.documentSettings);
  writeRawResponseViewSheet(spreadsheet, responseSheet, config);
  writeExpandedStudentSheet(spreadsheet, responseSheet, config);
  writeReconciledPreferenceSheet(spreadsheet, config);
  writeReviewResponseSheet(spreadsheet, config);
  writeUsageSheet(spreadsheet);
  linkRosterSummarySheet(spreadsheet, config.roster.length);
  fitOutputColumns(spreadsheet, config);
  removeDefaultBlankSheet(spreadsheet);
  configureSheetVisibility(spreadsheet);
  moveOutputsToScriptFolder(form, spreadsheet);

  console.log('編集用フォーム: ' + form.getEditUrl());
  console.log('保護者回答用フォーム: ' + form.getPublishedUrl());
  console.log('回答スプレッドシート: ' + spreadsheet.getUrl());
}

/**
 * 「=」「+」「-」「@」で始まる文字列は、シート上で数式として
 * 解釈されないよう先頭にアポストロフィを付けます。
 */
function sanitizeSheetValues(rows) {
  return rows.map(function(row) {
    return row.map(function(value) {
      if (typeof value === 'string' && /^[=+\\-@]/.test(value)) {
        return "'" + value;
      }
      return value;
    });
  });
}

function createAttendanceNumberValidation() {
  return FormApp.createTextValidation()
    .requireTextMatchesPattern('^([1-9]|[1-9][0-9])$')
    .setHelpText('1から99までの半角数字で入力してください。')
    .build();
}

/**
 * フォームの質問名は保護者がそのまま目にするため、
 * 「お子さまの学級」「2人目のお子さまの学級」のような自然な表現にします。
 * 質問名は回答シートの列名になるので、3人分すべて一意です。
 */
function studentFieldTitle(studentIndex, kind) {
  const prefix = studentIndex === 1 ? 'お子さまの' : studentIndex + '人目のお子さまの';
  return prefix + kind;
}

function addStudentFields(form, config, studentIndex, numberValidation) {
  form.addListItem()
    .setTitle(studentFieldTitle(studentIndex, '学級'))
    .setChoiceValues(config.classes)
    .setRequired(true);

  form.addTextItem()
    .setTitle(studentFieldTitle(studentIndex, '出席番号'))
    .setHelpText('半角数字で入力してください。')
    .setValidation(numberValidation)
    .setRequired(true);

  form.addTextItem()
    .setTitle(studentFieldTitle(studentIndex, '氏名'))
    .setHelpText('名字と名前を入力してください。')
    .setRequired(true);
}

function writeScheduleConditionSheet(spreadsheet, config) {
  let sheet = spreadsheet.getSheetByName('日程条件');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('日程条件');
  }
  sheet.clear();

  const rows = [
    ['section', 'key', 'value', 'sort', 'slotId', 'date', 'dateLabel', 'start', 'end', 'display', 'className'],
    ['meta', 'title', config.title, '', '', '', '', '', '', '', ''],
    ['meta', 'durationMinutes', String(config.durationMinutes), '', '', '', '', '', '', '', ''],
    ['meta', 'responseMode', config.responseMode, '', '', '', '', '', '', '', ''],
    ['meta', 'responseModeLabel', config.responseLabels.label, '', '', '', '', '', '', '', ''],
    ['meta', 'schemaVersion', '3', '', '', '', '', '', '', '', ''],
    ['meta', 'rawResponseSheet', '元データ', '', '', '', '', '', '', '', ''],
    ['meta', 'rawResponseViewSheet', RAW_RESPONSE_VIEW_SHEET, '', '', '', '', '', '', '', ''],
    ['meta', 'expandedStudentSheet', '※編集禁止【自動変換】生徒別データ', '', '', '', '', '', '', '', ''],
    ['meta', 'reconciledPreferenceSheet', RECONCILED_PREFERENCE_SHEET, '', '', '', '', '', '', '', ''],
    ['meta', 'reviewResponseSheet', '入力不備・要確認履歴', '', '', '', '', '', '', '', ''],
    ['meta', 'rawResponseRowLimit', String(getRawResponseRowLimit(config) - 1), '', '', '', '', '', '', '', ''],
    ['meta', 'remarkTitle', config.remarkSettings && config.remarkSettings.enabled
      ? (config.remarkSettings.title || '備考')
      : '', '', '', '', '', '', '', '', ''],
    ['meta', 'document.schoolName', config.documentSettings.schoolName || '', '', '', '', '', '', '', '', ''],
    ['meta', 'document.principalName', config.documentSettings.principalName || '', '', '', '', '', '', '', '', ''],
    ['meta', 'document.noticeTitle', config.documentSettings.noticeTitle || '', '', '', '', '', '', '', '', ''],
    ['meta', 'document.noticeDeliveryDate', config.documentSettings.noticeDeliveryDate || '', '', '', '', '', '', '', '', ''],
    ['meta', 'document.noticePlace', config.documentSettings.noticePlace || '', '', '', '', '', '', '', '', ''],
    ['meta', 'document.noticeMessage', config.documentSettings.noticeMessage || '', '', '', '', '', '', '', '', ''],
    ['meta', 'document.noticeNote', config.documentSettings.noticeNote || '', '', '', '', '', '', '', '', ''],
    ['meta', 'createdAt', new Date().toISOString(), '', '', '', '', '', '', '', '']
  ];

  config.classes.forEach(function(className, index) {
    rows.push(['class', '', className, String(index + 1), '', '', '', '', '', '', className]);
  });

  let slotSort = 1;
  config.days.forEach(function(day) {
    day.slots.forEach(function(slot) {
      rows.push([
        'slot',
        '',
        '',
        String(slotSort),
        slot.id,
        day.date,
        day.label,
        slot.start,
        slot.end,
        slot.display,
        ''
      ]);
      slotSort += 1;
    });
  });

  sheet.getRange(1, 1, rows.length, rows[0].length)
    .setValues(sanitizeSheetValues(rows));
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
}

function writeRosterSheet(spreadsheet, roster) {
  let sheet = spreadsheet.getSheetByName(ROSTER_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(ROSTER_SHEET);
  }
  sheet.clear();
  // 学級名をそのまま列に持ちます。「◯年◯組」で表せない特別支援学級を扱うため、
  // 学年・クラス番号から組み立て直すことはしません。
  const rows = [['学級', '出席番号', '氏名', '回答状況', '入力された氏名', '確認']];
  roster.forEach(function(student) {
    rows.push([student.className, student.number, student.name, '', '', '']);
  });
  // insertSheetの既定は1000行。名簿が1000名を超えても書き込めるよう先に広げる。
  ensureSheetSize(sheet, rows.length, rows[0].length);
  sheet.getRange(1, 1, rows.length, rows[0].length)
    .setValues(sanitizeSheetValues(rows));
  sheet.setFrozenRows(1);
  styleHeaderRow(sheet, rows[0].length);
  // 列幅は fitOutputColumns で最後に決める（この時点では回答状況の数式がまだ入っていない）
}

function findResponseSheet(spreadsheet) {
  const sheets = spreadsheet.getSheets();
  const exact = sheets.find(function(sheet) {
    return sheet.getName() === '元データ';
  });
  if (exact) return exact;
  for (let index = 0; index < sheets.length; index += 1) {
    const name = sheets[index].getName();
    if (name.includes('フォームの回答') || name.includes('Form Responses')) {
      return sheets[index];
    }
  }
  return null;
}

function hasRawResponseHeaders(responseSheet, config) {
  const lastColumn = responseSheet.getLastColumn();
  if (lastColumn < 2) return false;
  const headers = responseSheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function(value) { return String(value).trim(); });
  const requiredHeaders = [];
  for (let studentIndex = 1; studentIndex <= 3; studentIndex += 1) {
    requiredHeaders.push(
      studentFieldTitle(studentIndex, '学級'),
      studentFieldTitle(studentIndex, '出席番号'),
      studentFieldTitle(studentIndex, '氏名')
    );
  }
  config.days.forEach(function(day) {
    requiredHeaders.push(
      config.responseLabels.questionPrefix + '（' + day.label + '）'
    );
  });
  if (config.remarkSettings && config.remarkSettings.enabled) {
    requiredHeaders.push(config.remarkSettings.title || '備考');
  }
  return requiredHeaders.every(function(title) {
    return headers.indexOf(title) !== -1;
  });
}

function prepareRawResponseSheet(spreadsheet, config) {
  let responseSheet = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    SpreadsheetApp.flush();
    responseSheet = findResponseSheet(spreadsheet);
    if (responseSheet && hasRawResponseHeaders(responseSheet, config)) break;
    Utilities.sleep(500);
  }
  if (!responseSheet || !hasRawResponseHeaders(responseSheet, config)) {
    throw new Error('Googleフォームの回答シートの準備が完了しませんでした。時間をおいて再実行してください。');
  }
  if (responseSheet.getName() !== '元データ') {
    responseSheet.setName('元データ');
  }
  const rawRowLimit = getRawResponseRowLimit(config);
  ensureSheetSize(responseSheet, rawRowLimit, responseSheet.getLastColumn());
  responseSheet.setFrozenRows(1);
  responseSheet.getRange('A1').setNote(
    'Googleフォームの回答元データです。列の追加・削除、見出しの変更、回答先の変更はしないでください。' +
    'このファイルでは最大' + (rawRowLimit - 1) + '回答まで自動集計します。'
  );
  addEditWarning(responseSheet, 'Googleフォームと連携する元データです。列や見出しを変更しないでください。');
  return responseSheet;
}

const EXPANDED_STUDENT_SHEET = '※編集禁止【自動変換】生徒別データ';
const ROSTER_SHEET = '名簿（原本）';
const RECONCILED_PREFERENCE_SHEET = '希望一覧';
const REVIEW_RESPONSE_SHEET = '入力不備・要確認履歴';
const USAGE_SHEET = '使い方';
const RAW_RESPONSE_VIEW_SHEET = '※編集禁止【フォーム回答】閲覧用';

function getConferenceSlots(config) {
  const slots = [];
  config.days.forEach(function(day, dayIndex) {
    day.slots.forEach(function(slot) {
      slots.push({
        dayIndex: dayIndex,
        dateLabel: day.label,
        display: slot.display,
        label: day.label + ' ' + slot.display
      });
    });
  });
  return slots;
}

function getRawResponseRowLimit(config) {
  return Math.max(3001, (config.roster || []).length * 8 + 501);
}

function columnToLetter(column) {
  let value = Number(column);
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function quoteSheetForFormula(name) {
  return "'" + String(name).replace(/'/g, "''") + "'";
}

function escapeFormulaText(value) {
  return String(value || '').replace(/"/g, '""');
}

function ensureSheetSize(sheet, rowCount, columnCount) {
  if (sheet.getMaxRows() < rowCount) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rowCount - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < columnCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), columnCount - sheet.getMaxColumns());
  }
}

function styleHeaderRow(sheet, columnCount) {
  if (columnCount < 1) return;
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground('#006064')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    // 折り返すと autoResize が見出しの文字幅を無視するため、折り返さない。
    // 見出しが長い時間枠の列だけ、各シート側で個別に折り返しを付ける。
    .setWrap(false);
}

function addEditWarning(sheet, description) {
  const protection = sheet.protect();
  protection.setDescription(
    description || '自動作成シートです。元データまたは名簿を修正してください。'
  );
  protection.setWarningOnly(true);
}

// 警告ではなく実際に編集を止めます。オーナー本人だけはGoogleの仕様上どうしても編集できてしまうため、
// 中身を壊されたくないシートは「原本を隠し、数式だけの閲覧用シートをこの保護で表示する」形にします。
function lockSheet(sheet, description) {
  const protection = sheet.protect();
  protection.setDescription(description);
  protection.setWarningOnly(false);
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
}

// フォーム回答の原本（元データ）をそのまま映す閲覧専用シート。
// 数式1本で原本を参照するので、このシートを触っても原本は一切変わりません。
function writeRawResponseViewSheet(spreadsheet, responseSheet, config) {
  let sheet = spreadsheet.getSheetByName(RAW_RESPONSE_VIEW_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(RAW_RESPONSE_VIEW_SHEET);
  sheet.clear();

  const rowLimit = getRawResponseRowLimit(config);
  const columnCount = Math.max(responseSheet.getLastColumn(), 1);
  ensureSheetSize(sheet, rowLimit, columnCount);

  const range = quoteSheetForFormula('元データ')
    + '!A1:' + columnToLetter(columnCount) + rowLimit;
  sheet.getRange('A1').setFormula(
    '=ARRAYFORMULA(IF(' + range + '="","",' + range + '))'
  );
  sheet.setFrozenRows(1);
  // A列はフォームのタイムスタンプ。数式で引くと書式が落ちるので日時表示を指定します。
  sheet.getRange(2, 1, rowLimit - 1, 1).setNumberFormat('yyyy/MM/dd HH:mm:ss');
  sheet.getRange('A1').setNote(
    'Googleフォームの回答をそのまま表示しています。閲覧専用で、ここを編集しても回答の原本は変わりません。'
  );
  lockSheet(sheet, 'フォーム回答の閲覧専用シートです。編集はできません。');
}

function writeExpandedStudentSheet(spreadsheet, responseSheet, config) {
  let sheet = spreadsheet.getSheetByName(EXPANDED_STUDENT_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(EXPANDED_STUDENT_SHEET);
  sheet.clear();

  const slots = getConferenceSlots(config);
  const remarkTitle = config.remarkSettings && config.remarkSettings.enabled
    ? (config.remarkSettings.title || '備考')
    : '担任へ事前に伝えたいこと';
  const visibleHeaders = [
    '回答ID',
    'タイムスタンプ',
    '元データ行',
    '回答内の生徒順',
    '入力学級',
    '入力出席番号',
    '入力氏名',
    '照合結果',
    '照合先',
    'きょうだい有無',
    'きょうだい情報'
  ].concat(slots.map(function(slot) {
    return slot.label;
  }), [remarkTitle]);
  const helperHeaders = ['__判定コード', '__解決先名簿行'];
  const headers = visibleHeaders.concat(helperHeaders);

  const rawRowLimit = getRawResponseRowLimit(config);
  ensureSheetSize(sheet, rawRowLimit * 3 + 10, headers.length);
  sheet.getRange(1, 1, 1, headers.length)
    .setValues(sanitizeSheetValues([headers]));
  sheet.getRange('A2').setFormula(
    buildExpandedStudentFormula(responseSheet, config, rawRowLimit)
  );
  sheet.setFrozenRows(1);
  styleHeaderRow(sheet, visibleHeaders.length);
  sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1)
    .setNumberFormat('yyyy/mm/dd hh:mm:ss');
  sheet.autoResizeColumns(1, Math.min(visibleHeaders.length, 11));
  if (slots.length > 0) {
    sheet.setColumnWidths(12, slots.length, 92);
    sheet.getRange(1, 12, sheet.getMaxRows(), slots.length)
      .setHorizontalAlignment('center')
      .setWrap(true);
  }
  sheet.hideColumns(visibleHeaders.length + 1, helperHeaders.length);
  addEditWarning(sheet);
}

function buildExpandedStudentFormula(responseSheet, config, rawRowLimit) {
  const lastColumn = Math.max(responseSheet.getLastColumn(), 1);
  const lastColumnLetter = columnToLetter(lastColumn);
  const rawSheet = quoteSheetForFormula(responseSheet.getName());
  const headerRange = rawSheet + '!$A$1:$' + lastColumnLetter + '$1';
  // Googleフォームは回答時に行を挿入するため、通常のA1参照は
  // A2:A3001 → A3:A3002のように自動でずれることがあります。
  // INDIRECTで参照文字列を固定し、常に2行目から新規回答を読み取ります。
  const rawRangeA1 = rawSheet + '!$A$2:$' + lastColumnLetter + '$' + rawRowLimit;
  const timestampRangeA1 = rawSheet + '!$A$2:$A$' + rawRowLimit;
  const rawRange = 'INDIRECT("' + escapeFormulaText(rawRangeA1) + '")';
  const timestampRange = 'INDIRECT("' + escapeFormulaText(timestampRangeA1) + '")';
  const rosterSheet = quoteSheetForFormula(ROSTER_SHEET);
  const rosterLastRow = config.roster.length + 1;
  const columnByTitle = function(title) {
    return 'INDEX(raw,0,MATCH("' + escapeFormulaText(title) + '",headers,0))';
  };

  const letParts = [
    'raw,FILTER(' + rawRange + ',' + timestampRange + '<>"")',
    'headers,' + headerRange,
    'sentAt,INDEX(raw,0,1)',
    'sourceRow,FILTER(ARRAYFORMULA(ROW(' + timestampRange + ')),' + timestampRange + '<>"")',
    'studentClassOne,' + columnByTitle(studentFieldTitle(1, '学級')),
    'studentNumberOne,' + columnByTitle(studentFieldTitle(1, '出席番号')),
    'studentNameOne,' + columnByTitle(studentFieldTitle(1, '氏名')),
    'studentClassTwo,' + columnByTitle(studentFieldTitle(2, '学級')),
    'studentNumberTwo,' + columnByTitle(studentFieldTitle(2, '出席番号')),
    'studentNameTwo,' + columnByTitle(studentFieldTitle(2, '氏名')),
    'studentClassThree,' + columnByTitle(studentFieldTitle(3, '学級')),
    'studentNumberThree,' + columnByTitle(studentFieldTitle(3, '出席番号')),
    'studentNameThree,' + columnByTitle(studentFieldTitle(3, '氏名')),
    'rosterClass,ARRAYFORMULA(TO_TEXT(' + rosterSheet + '!$A$2:$A$' + rosterLastRow + '))',
    'rosterNumber,ARRAYFORMULA(IFERROR(TO_TEXT(VALUE(' + rosterSheet + '!$B$2:$B$' + rosterLastRow + ')),""))',
    'rosterName,ARRAYFORMULA(REGEXREPLACE(TO_TEXT(' + rosterSheet + '!$C$2:$C$' + rosterLastRow + '),"[ 　]",""))',
    'rosterDisplayName,' + rosterSheet + '!$C$2:$C$' + rosterLastRow
  ];

  const dayAnswerNames = [];
  config.days.forEach(function(day, index) {
    const answerName = 'answerDay' + columnToLetter(index + 1);
    dayAnswerNames.push(answerName);
    letParts.push(
      answerName + ',' + columnByTitle(
        config.responseLabels.questionPrefix + '（' + day.label + '）'
      )
    );
  });

  if (config.remarkSettings && config.remarkSettings.enabled) {
    letParts.push(
      'teacherRemark,ARRAYFORMULA(IFERROR(' +
      columnByTitle(config.remarkSettings.title || '備考') +
      ',IF(sentAt<>"","","")))'
    );
  } else {
    letParts.push('teacherRemark,ARRAYFORMULA(IF(sentAt<>"","",""))');
  }

  letParts.push(
    'householdOne,MAP(studentClassTwo,studentNameTwo,studentClassThree,studentNameThree,LAMBDA(cTwo,nTwo,cThree,nThree,TEXTJOIN("、",TRUE,IF(nTwo<>"",cTwo&" "&nTwo,""),IF(nThree<>"",cThree&" "&nThree,""))))',
    'householdTwo,MAP(studentClassOne,studentNameOne,studentClassThree,studentNameThree,LAMBDA(cOne,nOne,cThree,nThree,TEXTJOIN("、",TRUE,IF(nOne<>"",cOne&" "&nOne,""),IF(nThree<>"",cThree&" "&nThree,""))))',
    'householdThree,MAP(studentClassOne,studentNameOne,studentClassTwo,studentNameTwo,LAMBDA(cOne,nOne,cTwo,nTwo,TEXTJOIN("、",TRUE,IF(nOne<>"",cOne&" "&nOne,""),IF(nTwo<>"",cTwo&" "&nTwo,""))))'
  );

  const slotExpressions = [];
  config.days.forEach(function(day, dayIndex) {
    day.slots.forEach(function(slot) {
      const found = 'ISNUMBER(SEARCH("' + escapeFormulaText(slot.display) + '",' + dayAnswerNames[dayIndex] + '))';
      slotExpressions.push(
        config.responseMode === 'checked_available'
          ? 'ARRAYFORMULA(IF(' + found + ',"○","×"))'
          : 'ARRAYFORMULA(IF(' + found + ',"×","○"))'
      );
    });
  });

  letParts.push(
    'slotValues,HSTACK(' + slotExpressions.join(',') + ')',
    'allSentAt,VSTACK(sentAt,sentAt,sentAt)',
    'allSourceRow,VSTACK(sourceRow,sourceRow,sourceRow)',
    'allStudentOrder,VSTACK(ARRAYFORMULA(IF(studentNameOne<>"",1,"")),ARRAYFORMULA(IF(studentNameTwo<>"",2,"")),ARRAYFORMULA(IF(studentNameThree<>"",3,"")))',
    'allClass,VSTACK(studentClassOne,studentClassTwo,studentClassThree)',
    'allNumber,VSTACK(studentNumberOne,studentNumberTwo,studentNumberThree)',
    'allName,VSTACK(studentNameOne,studentNameTwo,studentNameThree)',
    'allHousehold,VSTACK(householdOne,householdTwo,householdThree)',
    'allSlotValues,VSTACK(slotValues,slotValues,slotValues)',
    'allRemark,VSTACK(teacherRemark,teacherRemark,teacherRemark)',
    'allResponseId,MAP(allSentAt,allSourceRow,LAMBDA(sentValue,rowValue,IF(sentValue="","",TEXT(sentValue,"yyyymmddhhmmss.000")&"-"&TEXT(rowValue,"00000"))))',
    'resolutionToken,MAP(allClass,allNumber,allName,LAMBDA(classValue,numberValue,nameValue,IF(nameValue="","",LET(normalizedClass,REGEXREPLACE(TO_TEXT(classValue),"[ 　]",""),normalizedNumber,IFERROR(TO_TEXT(VALUE(TO_TEXT(numberValue))),""),normalizedName,REGEXREPLACE(TO_TEXT(nameValue),"[ 　]",""),numberPosition,IFERROR(XMATCH(1,ARRAYFORMULA((rosterClass=normalizedClass)*(rosterNumber=normalizedNumber)),0),0),nameCount,SUMPRODUCT((rosterClass=normalizedClass)*(rosterName=normalizedName)),namePosition,IF(nameCount=1,IFERROR(XMATCH(1,ARRAYFORMULA((rosterClass=normalizedClass)*(rosterName=normalizedName)),0),0),0),numberMatchesName,IF(numberPosition>0,INDEX(rosterName,MAX(1,numberPosition))=normalizedName,FALSE),resultCode,IF(nameCount=1,IF(AND(numberPosition>0,numberPosition<>namePosition),"conflict",IF(INDEX(rosterNumber,MAX(1,namePosition))=normalizedNumber,"exact","number_mismatch")),IF(nameCount>1,IF(AND(numberPosition>0,numberMatchesName),"exact","ambiguous_name"),IF(numberPosition>0,"name_mismatch","unmatched"))),resolvedPosition,IF(OR(resultCode="exact",resultCode="number_mismatch"),IF(nameCount=1,namePosition,numberPosition),IF(resultCode="name_mismatch",numberPosition,0)),resultCode&"|"&TO_TEXT(IF(resolvedPosition,resolvedPosition+1,0))))))',
    'matchCode,ARRAYFORMULA(IF(resolutionToken="","",REGEXEXTRACT(resolutionToken,"^[^|]+")))',
    'resolvedRosterRow,ARRAYFORMULA(IFERROR(VALUE(REGEXREPLACE(resolutionToken,"^.*[|]","")),0))',
    'matchLabel,MAP(matchCode,LAMBDA(codeValue,SWITCH(codeValue,"exact","正常","number_mismatch","番号補正済み","name_mismatch","氏名要確認","conflict","番号と氏名が別の生徒","ambiguous_name","同姓同名で特定不可","unmatched","名簿に該当なし","")))',
    'resolvedLabel,MAP(resolvedRosterRow,LAMBDA(rowValue,IF(rowValue=0,"",INDEX(rosterClass,MAX(1,rowValue-1))&" "&INDEX(rosterNumber,MAX(1,rowValue-1))&"番 "&INDEX(rosterDisplayName,MAX(1,rowValue-1)))))',
    'allData,HSTACK(allResponseId,allSentAt,allSourceRow,allStudentOrder,allClass,allNumber,allName,matchLabel,resolvedLabel,ARRAYFORMULA(IF(allHousehold<>"","あり","なし")),allHousehold,allSlotValues,allRemark,matchCode,resolvedRosterRow)',
    'SORT(FILTER(allData,allName<>""),2,TRUE,3,TRUE,4,TRUE)'
  );

  return '=IF(COUNTA(' + timestampRange + ')=0,"",LET(' + letParts.join(',') + '))';
}

function writeReconciledPreferenceSheet(spreadsheet, config) {
  let sheet = spreadsheet.getSheetByName(RECONCILED_PREFERENCE_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(RECONCILED_PREFERENCE_SHEET);
  sheet.clear();

  const slots = getConferenceSlots(config);
  const remarkTitle = config.remarkSettings && config.remarkSettings.enabled
    ? (config.remarkSettings.title || '備考')
    : '担任へ事前に伝えたいこと';
  const visibleHeaders = [
    '学級',
    '出席番号',
    '氏名',
    '照合結果',
    '採用回答日時',
    '入力学級',
    '入力出席番号',
    '入力氏名',
    '回答回数',
    'きょうだい情報'
  ].concat(slots.map(function(slot) {
    return slot.label;
  }), [remarkTitle]);
  const helperHeaders = ['__採用行', '__判定コード', '__回答回数'];
  const allHeaders = visibleHeaders.concat(helperHeaders);
  const rowCount = Math.max(config.roster.length + 10, 100);
  ensureSheetSize(sheet, rowCount, allHeaders.length);
  sheet.getRange(1, 1, 1, allHeaders.length)
    .setValues(sanitizeSheetValues([allHeaders]));

  if (config.roster.length > 0) {
    const rosterRows = config.roster.map(function(student) {
      return [student.className, student.number, student.name];
    });
    sheet.getRange(2, 1, rosterRows.length, 3)
      .setValues(sanitizeSheetValues(rosterRows));

    const helperStartColumn = visibleHeaders.length + 1;
    const adoptedColumn = columnToLetter(helperStartColumn);
    const codeColumn = columnToLetter(helperStartColumn + 1);
    const countColumn = columnToLetter(helperStartColumn + 2);
    const expandedLastRow = getRawResponseRowLimit(config) * 3 + 1;
    const expandedSheet = quoteSheetForFormula(EXPANDED_STUDENT_SHEET);
    const expandedVisibleColumnCount = 12 + slots.length;
    const expandedCodeColumn = columnToLetter(expandedVisibleColumnCount + 1);
    const expandedRosterRowColumn = columnToLetter(expandedVisibleColumnCount + 2);
    const expandedLastColumn = expandedRosterRowColumn;

    const helperFormulas = [];
    const visibleFormulas = [];
    config.roster.forEach(function(student, index) {
      const row = index + 2;
      const adoptedRef = '$' + adoptedColumn + row;
      const codeRef = '$' + codeColumn + row;
      const countRef = '$' + countColumn + row;
      helperFormulas.push([
        buildReconciliationLookupFormula(
          row,
          expandedLastRow,
          expandedCodeColumn,
          expandedRosterRowColumn
        )
      ]);

      const formulas = [
        '=IF(' + codeRef + '="exact",IF(' + countRef + '>1,"正常（最新回答を採用）","正常"),SWITCH(' + codeRef + ',"number_mismatch","要確認：出席番号を名簿に合わせて補正","name_mismatch","要確認：入力氏名が名簿と異なる","未提出"))',
        buildExpandedIndexFormula(expandedSheet, adoptedRef, 2, expandedLastColumn),
        buildExpandedIndexFormula(expandedSheet, adoptedRef, 5, expandedLastColumn),
        buildExpandedIndexFormula(expandedSheet, adoptedRef, 6, expandedLastColumn),
        buildExpandedIndexFormula(expandedSheet, adoptedRef, 7, expandedLastColumn),
        '=' + countRef,
        buildExpandedIndexFormula(expandedSheet, adoptedRef, 11, expandedLastColumn)
      ];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        formulas.push(
          buildExpandedIndexFormula(expandedSheet, adoptedRef, 12 + slotIndex, expandedLastColumn)
        );
      }
      formulas.push(
        buildExpandedIndexFormula(expandedSheet, adoptedRef, 12 + slots.length, expandedLastColumn)
      );
      visibleFormulas.push(formulas);
    });

    sheet.getRange(2, helperStartColumn, helperFormulas.length, 1)
      .setFormulas(helperFormulas);
    sheet.getRange(2, 4, visibleFormulas.length, visibleHeaders.length - 3)
      .setFormulas(visibleFormulas);
    sheet.hideColumns(helperStartColumn, helperHeaders.length);
  }

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  styleHeaderRow(sheet, visibleHeaders.length);
  sheet.getRange(2, 5, Math.max(config.roster.length, 1), 1)
    .setNumberFormat('yyyy/mm/dd hh:mm:ss');
  // 列幅は fitOutputColumns で全シートを書き終えてから決める（数式の結果を見て合わせるため）
  if (slots.length > 0) {
    sheet.setColumnWidths(11, slots.length, 92);
    sheet.getRange(1, 11, sheet.getMaxRows(), slots.length)
      .setHorizontalAlignment('center')
      .setWrap(true);
  }
  addEditWarning(sheet);
}

function buildExpandedIndexFormula(expandedSheet, rowReference, columnIndex, lastColumn) {
  return '=IF(' + rowReference + '=0,"",INDEX(' + expandedSheet + '!$A:$' + lastColumn + ',' + rowReference + ',' + columnIndex + '))';
}

function buildReconciliationLookupFormula(rosterRow, expandedLastRow, codeColumn, rosterRowColumn) {
  const expanded = quoteSheetForFormula(EXPANDED_STUDENT_SHEET);
  const resolvedRange = expanded + '!$' + rosterRowColumn + '$2:$' + rosterRowColumn + '$' + expandedLastRow;
  const codeRange = expanded + '!$' + codeColumn + '$2:$' + codeColumn + '$' + expandedLastRow;
  return '=IFERROR(LET(resolvedRows,' + resolvedRange + ',matchPosition,XMATCH(' + rosterRow + ',resolvedRows,0,-1),HSTACK(matchPosition+1,INDEX(' + codeRange + ',matchPosition),COUNTIF(resolvedRows,' + rosterRow + '))),HSTACK(0,"unsubmitted",0))';
}

function writeReviewResponseSheet(spreadsheet, config) {
  let sheet = spreadsheet.getSheetByName(REVIEW_RESPONSE_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(REVIEW_RESPONSE_SHEET);
  sheet.clear();

  const slots = getConferenceSlots(config);
  const remarkTitle = config.remarkSettings && config.remarkSettings.enabled
    ? (config.remarkSettings.title || '備考')
    : '担任へ事前に伝えたいこと';
  const historyHeaders = [
    '回答ID',
    '回答日時',
    '元データ行',
    '入力学級',
    '入力出席番号',
    '入力氏名',
    '照合結果',
    '照合先',
    'きょうだい情報',
    remarkTitle
  ];
  const headers = historyHeaders.concat(['集計状態']);
  const rawRowLimit = getRawResponseRowLimit(config);
  const expandedLastRow = rawRowLimit * 3 + 1;
  const expandedVisibleColumnCount = 12 + slots.length;
  const expandedCodeColumnIndex = expandedVisibleColumnCount + 1;
  const expandedLastColumn = columnToLetter(expandedVisibleColumnCount + 2);
  const expanded = quoteSheetForFormula(EXPANDED_STUDENT_SHEET);
  const expandedRange = expanded + '!$A$2:$' + expandedLastColumn + '$' + expandedLastRow;
  const nameRange = expanded + '!$G$2:$G$' + expandedLastRow;
  const formula = '=IFERROR(IF(COUNTA(' + nameRange + ')=0,"",LET(data,FILTER(' + expandedRange + ',' + nameRange + '<>""),codes,INDEX(data,0,' + expandedCodeColumnIndex + '),reviewData,FILTER(data,codes<>"exact"),HSTACK(INDEX(reviewData,0,1),INDEX(reviewData,0,2),INDEX(reviewData,0,3),INDEX(reviewData,0,5),INDEX(reviewData,0,6),INDEX(reviewData,0,7),INDEX(reviewData,0,8),INDEX(reviewData,0,9),INDEX(reviewData,0,11),INDEX(reviewData,0,' + (12 + slots.length) + ')))),"")';

  ensureSheetSize(sheet, rawRowLimit * 3 + 10, headers.length);
  sheet.getRange(1, 1, 1, headers.length)
    .setValues(sanitizeSheetValues([headers]));
  sheet.getRange('A2').setFormula(formula);
  sheet.getRange('K2').setFormula(
    '=IF(COUNTA(' + quoteSheetForFormula('元データ') + '!$A:$A)>' + rawRowLimit + ',"警告：自動集計の回答上限を超えています。作成担当者へ連絡してください。","")'
  );
  sheet.getRange('A1').setNote('入力に不備があった回答の履歴です。正常な再回答後も古い履歴は残るため、回答日時と「名簿照合・希望一覧」の最新状態を合わせて確認してください。');
  sheet.setFrozenRows(1);
  styleHeaderRow(sheet, headers.length);
  sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1)
    .setNumberFormat('yyyy/mm/dd hh:mm:ss');
  // 列幅は fitOutputColumns で最後に決める
  addEditWarning(sheet);
}

function linkRosterSummarySheet(spreadsheet, rosterLength) {
  if (rosterLength < 1) return;
  const sheet = spreadsheet.getSheetByName(ROSTER_SHEET);
  ensureSheetSize(sheet, rosterLength + 1, 6);
  const reconciled = quoteSheetForFormula(RECONCILED_PREFERENCE_SHEET);
  const formulas = [];
  for (let index = 0; index < rosterLength; index += 1) {
    const row = index + 2;
    const status = reconciled + '!$D' + row;
    formulas.push([
      '=IF(' + status + '="未提出","未回答",IF(LEFT(' + status + ',3)="要確認","要確認","回答済み"))',
      '=' + reconciled + '!$H' + row,
      '=' + status
    ]);
  }
  sheet.getRange(2, 4, formulas.length, 3).setFormulas(formulas);
}

function writeSchoolSettingsSheet(spreadsheet, settings) {
  let sheet = spreadsheet.getSheetByName('学校設定');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('学校設定');
  }
  sheet.clear();
  const rows = [
    ['項目', '設定値'],
    ['学校名', settings.schoolName || ''],
    ['校長名', settings.principalName || ''],
    ['案内文書のタイトル', settings.noticeTitle || ''],
    ['配布予定日', settings.noticeDeliveryDate || ''],
    ['懇談場所', settings.noticePlace || ''],
    ['決定通知の本文', settings.noticeMessage || ''],
    ['お願い・連絡事項', settings.noticeNote || '']
  ];
  sheet.getRange(1, 1, rows.length, rows[0].length)
    .setValues(sanitizeSheetValues(rows));
  sheet.setFrozenRows(1);
  // 決定通知の本文などが長いため、autoResize ではなく固定幅＋折り返しにする
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 560);
  sheet.getRange(1, 1, rows.length, rows[0].length)
    .setVerticalAlignment('top')
    .setWrap(true);
}

function removeDefaultBlankSheet(spreadsheet) {
  const defaultNames = ['シート1', 'Sheet1'];
  spreadsheet.getSheets().forEach(function(sheet) {
    if (
      defaultNames.indexOf(sheet.getName()) !== -1 &&
      spreadsheet.getSheets().length > 1 &&
      sheet.getLastRow() === 0 &&
      sheet.getLastColumn() === 0
    ) {
      spreadsheet.deleteSheet(sheet);
    }
  });
}

// 見出しと値の両方が収まるように列幅を整えます。
// autoResizeColumns はその時点の表示内容だけを見るため、狭すぎ・広すぎを最小/最大幅で挟みます。
function fitColumns(sheet, startColumn, columnCount, minWidth, maxWidth) {
  if (!sheet || columnCount < 1) return;
  sheet.autoResizeColumns(startColumn, columnCount);
  for (let index = 0; index < columnCount; index += 1) {
    const column = startColumn + index;
    const width = sheet.getColumnWidth(column);
    if (width < minWidth) {
      sheet.setColumnWidth(column, minWidth);
    } else if (width > maxWidth) {
      sheet.setColumnWidth(column, maxWidth);
    }
  }
}

// 列幅は全シートを書き終えてから決めます。シート作成の途中では数式がまだ計算されておらず、
// 見出しの幅だけで列幅が決まってしまうためです。
function fitOutputColumns(spreadsheet, config) {
  SpreadsheetApp.flush();
  const slotCount = getConferenceSlots(config).length;

  // 学級・出席番号・氏名・回答状況・入力された氏名・確認
  fitColumns(spreadsheet.getSheetByName(ROSTER_SHEET), 1, 6, 90, 320);

  const reconciled = spreadsheet.getSheetByName(RECONCILED_PREFERENCE_SHEET);
  if (reconciled) {
    // 学級〜きょうだい情報。時間枠より右は日時が長いので固定幅のままにする。
    fitColumns(reconciled, 1, 10, 90, 320);
    const remarkColumn = 11 + slotCount;
    reconciled.setColumnWidth(remarkColumn, 260);
    reconciled.getRange(1, remarkColumn, reconciled.getMaxRows(), 1)
      .setVerticalAlignment('top')
      .setWrap(true);
  }

  const review = spreadsheet.getSheetByName(REVIEW_RESPONSE_SHEET);
  if (review) {
    // 回答ID〜きょうだい情報
    fitColumns(review, 1, 9, 90, 320);
    review.setColumnWidth(10, 260);
    review.setColumnWidth(11, 110);
    review.getRange(1, 10, review.getMaxRows(), 1)
      .setVerticalAlignment('top')
      .setWrap(true);
  }
}

// どのシートを見て、どこを直せばよいかを1枚目に置きます。
function writeUsageSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(USAGE_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(USAGE_SHEET);
  sheet.clear();

  // 行の種類を覚えながら組み立てて、あとでまとめて書式を当てる
  // （行番号を直接書くと、文言を1行足しただけで書式がずれるため）
  const rows = [];
  const sectionRows = [];   // 見出し行（太字）
  const checkRows = [];     // 先生が必ず見る行（色付き）
  const push = (row, kind) => {
    rows.push(row);
    if (kind === 'section') sectionRows.push(rows.length);
    if (kind === 'check') checkRows.push(rows.length);
  };

  push(['区分', 'シート', '何のシートか', '先生がすること'], 'header');

  push(['① 先生が確認するシート', '', '', ''], 'section');
  push([
    '要確認',
    REVIEW_RESPONSE_SHEET,
    '名簿と照合できなかった回答が出ます。学級・出席番号・氏名の打ち間違いが原因です。',
    '行があれば対応します。空なら何もしなくて大丈夫です'
  ], 'check');
  push([
    '要確認',
    ROSTER_SHEET,
    '学級・出席番号・氏名の原本です。照合はこのシートを基準に行います。右3列に提出状況が自動で出ます。',
    '未提出の確認と催促に使います。氏名や出席番号の間違いはここを直します'
  ], 'check');

  push(['② 様子を見るシート（書き換えない）', '', '', ''], 'section');
  push([
    '見るだけ',
    RECONCILED_PREFERENCE_SHEET,
    '名簿の1人ずつに、採用した回答と各時間枠の○×が並びます。集まり具合の全体像が分かります。',
    '数式で自動計算しています。直接書き換えないでください'
  ], null);
  push([
    '見るだけ',
    RAW_RESPONSE_VIEW_SHEET,
    '保護者が送信した回答をそのまま表示します。個別に中身を確かめたいときに見ます。',
    '閲覧専用です。編集できません'
  ], null);

  push(['③ さわらないシート（機械が読むためのデータ）', '', '', ''], 'section');
  push([
    'さわらない',
    '元データ / ' + EXPANDED_STUDENT_SHEET + ' / 日程条件 / 学校設定（いずれも非表示）',
    '集計と、日程を決めるページへの受け渡しに使う内部データです。人が読む形にはなっていません。',
    '開く必要はありません。並べ替え・削除をすると日程を決めるページで読み込めなくなります'
  ], null);

  push(['', '', '', ''], null);
  push(['進め方', '', '', ''], 'section');
  push(['1', 'フォームのURLを保護者へ配る', '案内のプリントは「案内を印刷」のページで作れます。', ''], null);
  push(['2', '回答が集まるのを待つ', ROSTER_SHEET + ' の右3列で、誰が出したかを確認できます。', '未提出の催促に使います'], null);
  push(['3', '入力の不備に対応する', REVIEW_RESPONSE_SHEET + ' に行が出ていたら、担任から保護者へ確認します。', ''], null);
  push([
    '4',
    'このファイルをExcel形式で保存する',
    'メニューの ファイル → ダウンロード → Microsoft Excel (.xlsx) を選びます。',
    '非表示のシートも一緒に保存されます。そのままのファイルを使ってください'
  ], 'check');
  push([
    '5',
    '「日程を決める」ページに読み込ませる',
    '保存した .xlsx を選ぶと、日程の割り当てと通知文書の印刷ができます。',
    ''
  ], 'check');

  push(['', '', '', ''], null);
  push(['困ったとき', '', '', ''], 'section');
  push([
    '氏名や出席番号が違う',
    ROSTER_SHEET + ' を直します。',
    RECONCILED_PREFERENCE_SHEET + ' は自動で計算し直されます。',
    ''
  ], null);
  push([
    '保護者の入力が間違っている',
    RAW_RESPONSE_VIEW_SHEET + ' で中身を確認します。',
    '担任から保護者へ確認し、正しい内容で回答し直してもらってください。新しい回答が採用されます。',
    ''
  ], null);
  push([
    '同じ人が2回答えた',
    '対応は不要です。',
    '後から送られた回答を自動で採用します。',
    ''
  ], null);
  push([
    '非表示のシートが気になる',
    '③のシートです。',
    '消さずにそのままにしてください。日程を決めるページがこのデータを読みます。',
    ''
  ], null);

  const colCount = rows[0].length;
  sheet.getRange(1, 1, rows.length, colCount)
    .setValues(sanitizeSheetValues(rows));
  sheet.setFrozenRows(1);
  styleHeaderRow(sheet, colCount);
  sectionRows.forEach(function(rowIndex) {
    sheet.getRange(rowIndex, 1, 1, colCount)
      .setFontWeight('bold')
      .setBackground('#eceff1');
  });
  checkRows.forEach(function(rowIndex) {
    sheet.getRange(rowIndex, 1, 1, colCount).setBackground('#fff8e1');
  });
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 460);
  sheet.setColumnWidth(4, 320);
  sheet.getRange(1, 1, rows.length, colCount).setVerticalAlignment('top').setWrap(true);
  lockSheet(sheet, '使い方の説明シートです。編集はできません。');
}

function configureSheetVisibility(spreadsheet) {
  const visibleSheetNames = [
    USAGE_SHEET,
    RECONCILED_PREFERENCE_SHEET,
    REVIEW_RESPONSE_SHEET,
    ROSTER_SHEET,
    RAW_RESPONSE_VIEW_SHEET
  ];

  // 日常運用で使う4枚を左端に並べます。
  visibleSheetNames.forEach(function(name, index) {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return;
    sheet.showSheet();
    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(index + 1);
  });

  const primarySheet = spreadsheet.getSheetByName(RECONCILED_PREFERENCE_SHEET);
  if (!primarySheet) {
    throw new Error('名簿照合・希望一覧シートを作成できませんでした。');
  }
  primarySheet.showSheet();
  spreadsheet.setActiveSheet(primarySheet);

  // 計算・データ受け渡し用のシートは、機能を保ったまま隠します。
  [
    '元データ',
    EXPANDED_STUDENT_SHEET,
    '日程条件',
    '学校設定'
  ].forEach(function(name) {
    const sheet = spreadsheet.getSheetByName(name);
    if (sheet) sheet.hideSheet();
  });
}

function moveOutputsToScriptFolder(form, spreadsheet) {
  try {
    const scriptFile = DriveApp.getFileById(ScriptApp.getScriptId());
    const parents = scriptFile.getParents();
    if (!parents.hasNext()) {
      console.log('Apps Scriptの保存先フォルダを取得できなかったため、フォームとスプレッドシートはマイドライブに作成されています。');
      return;
    }

    const targetFolder = parents.next();
    DriveApp.getFileById(form.getId()).moveTo(targetFolder);
    DriveApp.getFileById(spreadsheet.getId()).moveTo(targetFolder);
    console.log('保存先フォルダ: ' + targetFolder.getName());
  } catch (error) {
    console.log('フォームとスプレッドシートのフォルダ移動を完了できませんでした: ' + error.message);
  }
}
`;
    }

    async function copyGeneratedCode() {
        const code = elements.gasOutput.textContent;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            elements.copyStatus.textContent = 'コードをコピーしました。Google Apps Scriptへ貼り付けてください。';
        } catch (error) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(elements.gasOutput);
            selection.removeAllRanges();
            selection.addRange(range);
            elements.copyStatus.textContent = 'コードを選択しました。ブラウザのコピー操作を実行してください。';
        }
    }

    function showResetConfirm() {
        elements.resetConfirmBanner.hidden = false;
        elements.resetConfirmBanner.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
        elements.resetCancelBtn.focus();
    }

    function hideResetConfirm() {
        elements.resetConfirmBanner.hidden = true;
    }

    function resetForm() {
        elements.formTitle.value = DEFAULT_TITLE;
        elements.formDescription.value = DEFAULT_DESCRIPTION;
        elements.classes.value = '';
        schoolRoster = [];
        elements.initialRosterStatus.hidden = true;
        elements.initialRosterStatus.textContent = '';
        elements.responseMode.value = 'checked_unavailable';
        elements.responseModeHint.textContent = RESPONSE_MODES.checked_unavailable.hint;
        elements.remarkEnabled.checked = true;
        elements.remarkTitle.value = '備考';
        elements.remarkHelpText.value = '懇談に関わって伝えたいことがあれば入力してください。';
        updateRemarkFieldsState();
        elements.schoolName.value = '';
        elements.principalName.value = '';
        elements.noticeTitle.value = DEFAULT_NOTICE_TITLE;
        elements.noticeDeliveryDate.value = formatInputDate(new Date());
        elements.noticePlace.value = '各教室';
        autoNoticeMessage = '';
        elements.noticeMessage.value = DEFAULT_NOTICE_MESSAGE;
        applyNoticeMessage();
        elements.noticeNote.value = DEFAULT_NOTICE_NOTE;
        elements.slotDuration.value = '15';
        elements.scheduleList.innerHTML = '';
        addScheduleRow();
        setDefaultDeadline();
        saveSchoolSettings();
        elements.resultArea.hidden = true;
        elements.gasOutput.textContent = '';
        hideError();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showError(errors) {
        const normalizedErrors = errors.map(error => typeof error === 'string' ? { message: error, fieldId: null } : error);
        elements.errorMessage.innerHTML = `<strong><i class="fas fa-circle-exclamation" aria-hidden="true"></i> 入力内容を確認してください</strong><ul>${normalizedErrors.map(error => `<li><button type="button" class="error-link" data-field-id="${escapeHtml(error.fieldId || '')}">${escapeHtml(error.message)}</button></li>`).join('')}</ul>`;
        elements.errorMessage.hidden = false;
        elements.errorMessage.querySelectorAll('.error-link').forEach(link => {
            link.addEventListener('click', () => focusErrorField(link.dataset.fieldId));
        });
        elements.errorMessage.focus();
        if (normalizedErrors[0]?.fieldId) focusErrorField(normalizedErrors[0].fieldId);
    }

    function focusErrorField(fieldId) {
        const field = document.getElementById(fieldId) || document.querySelector(`.${fieldId}`);
        const target = field || (fieldId === 'initialRosterFile' ? document.querySelector('label[for="initialRosterFile"]') : null);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (target.tagName !== 'LABEL') target.focus({ preventScroll: true });
        target.classList.remove('is-error-highlight');
        void target.offsetWidth;
        target.classList.add('is-error-highlight');
    }

    function hideError() {
        elements.errorMessage.hidden = true;
        elements.errorMessage.innerHTML = '';
    }

    function appendDeadline(description, deadline) {
        if (!deadline) return description;
        return `${description}\n\n回答期限：${formatJapaneseDate(deadline)}`;
    }

    function saveSchoolSettings() {
        const schedules = Array.from(elements.scheduleList.querySelectorAll('.schedule-card'))
            .map(readScheduleCard);
        const settings = {
            schoolName: elements.schoolName.value.trim(),
            principalName: elements.principalName.value.trim(),
            responseDeadline: elements.responseDeadline.value,
            conferencePeriod: schedules
                .filter(schedule => schedule.date)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(schedule => formatConferenceDate(schedule.date))
                .join('、')
        };
        try {
            sessionStorage.setItem(SCHOOL_SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            // タブ内の一時保存が使えない場合もコード生成は続行する。
        }
    }

    function getResponseModeLabels(mode) {
        return RESPONSE_MODES[mode] || RESPONSE_MODES.checked_unavailable;
    }

    function createSlotObjects(schedule, duration) {
        const start = timeToMinutes(schedule.start);
        const end = timeToMinutes(schedule.end);
        const hasBreakStart = schedule.breakStart !== '';
        const hasBreakEnd = schedule.breakEnd !== '';

        if (!Number.isFinite(duration) || duration <= 0) {
            return { error: '1枠の時間を正しく設定してください。', slots: [] };
        }
        if (start === null || end === null) {
            return { error: '開始時刻と終了時刻を入力してください。', slots: [] };
        }
        if (start >= end) {
            return { error: '終了時刻は開始時刻より後にしてください。', slots: [] };
        }
        if (hasBreakStart !== hasBreakEnd) {
            return { error: '除外時間は開始と終了の両方を入力してください。', slots: [] };
        }

        let breakStart = null;
        let breakEnd = null;
        if (hasBreakStart && hasBreakEnd) {
            breakStart = timeToMinutes(schedule.breakStart);
            breakEnd = timeToMinutes(schedule.breakEnd);
            if (breakStart >= breakEnd) {
                return { error: '除外時間の終了は開始より後にしてください。', slots: [] };
            }
            if (breakStart < start || breakEnd > end) {
                return { error: '除外時間は懇談時間の範囲内にしてください。', slots: [] };
            }
        }

        const slots = [];
        for (let cursor = start; cursor + duration <= end; cursor += duration) {
            const slotEnd = cursor + duration;
            const overlapsBreak = breakStart !== null
                && cursor < breakEnd
                && slotEnd > breakStart;
            if (!overlapsBreak) {
                slots.push({
                    id: `${schedule.date}_${minutesToCompactTime(cursor)}`,
                    start: minutesToTime(cursor),
                    end: minutesToTime(slotEnd),
                    display: `${minutesToTime(cursor)}〜${minutesToTime(slotEnd)}`
                });
            }
        }

        if (slots.length === 0) {
            return {
                error: '作成できる時間枠がありません。時間設定を見直してください。',
                slots: []
            };
        }
        return { error: null, slots };
    }

    function formatJapaneseDate(dateString) {
        const parts = dateString.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return `${parts[0]}年${parts[1]}月${parts[2]}日（${WEEKDAYS[date.getDay()]}）`;
    }

    function formatConferenceDate(dateString) {
        const parts = dateString.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return `${parts[1]}月${parts[2]}日（${WEEKDAYS[date.getDay()]}）`;
    }

    function formatInputDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function uniqueNonEmptyLines(value) {
        return [...new Set(
            value.split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
        )];
    }

    function normalizeNumber(value) {
        const normalized = String(value || '')
            .trim()
            .replace(/[０-９]/g, char => {
                return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
            });
        const match = normalized.match(/\d+/);
        return match ? String(Number(match[0])) : '';
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function timeToMinutes(time) {
        if (!/^\d{2}:\d{2}$/.test(time)) return null;
        const [hours, minutes] = time.split(':').map(Number);
        if (hours > 23 || minutes > 59) return null;
        return hours * 60 + minutes;
    }

    function minutesToCompactTime(minutes) {
        const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
        const rest = String(minutes % 60).padStart(2, '0');
        return `${hours}${rest}`;
    }

    function minutesToTime(minutes) {
        const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
        const rest = String(minutes % 60).padStart(2, '0');
        return `${hours}:${rest}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    window.ConferenceFormGenerator = {
        createSlots,
        createSlotObjects,
        generateGas,
        formatJapaneseDate,
        getResponseModeLabels,
        parseRosterWorksheet,
        classesFromRoster,
        uniqueNonEmptyLines
    };
})();
