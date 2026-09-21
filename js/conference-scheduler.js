(function () {
    'use strict';

    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
    const SCHOOL_SETTINGS_KEY = 'conferenceSchoolSettings';
    const DEFAULT_NOTICE_TITLE = '三者懇談 日時のお知らせ';
    // 回答Excel内の名簿シート名。先頭が現行、以降は旧バージョンとの互換用。
    const ROSTER_SHEET_NAMES = ['名簿（原本）', '名簿'];
    const state = {
        roster: [],
        students: new Map(),
        duplicates: [],
        rosterOnly: [],
        externalResponses: [],
        responseRecords: [],
        slots: [],
        meta: {},
        selectedClass: '',
        assignments: new Map(),
        undecided: [],
        // 今回の懇談を組まない生徒（交流学級側で特別支援学級の生徒を外す等）。キーは 学級|出席番号。
        excludedStudents: new Set(),
        blockedSlots: new Set(),
        conflictKeys: new Set(),
        showAllNotices: false,
        // クラスごとの作業状態（割当・未決定・空けコマ）。クラスを切り替えても消えないよう保持する。
        classStates: new Map()
    };

    const elements = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindEvents();
        setDefaultDate();
        applySchoolSettingsFromSession();
    }

    function applySchoolSettingsFromSession() {
        // ①フォーム作成と同じタブで開いた場合、学校名・校長名を印刷設定へ引き継ぐ。
        // 回答Excelに学校設定が入っていれば、読み込み時にそちらが優先して上書きする。
        try {
            const storedValue = sessionStorage.getItem(SCHOOL_SETTINGS_KEY);
            if (!storedValue) return;
            const settings = JSON.parse(storedValue);
            if (!settings || typeof settings !== 'object') return;
            if (settings.schoolName && elements.printSchoolName) elements.printSchoolName.value = settings.schoolName;
            if (settings.principalName && elements.printPrincipalName) elements.printPrincipalName.value = settings.principalName;
        } catch (error) {
            // 引き継げなくても画面で直接入力して利用できる。
        }
    }

    function cacheElements() {
        [
            'answerFile',
            'answerFileName',
            'loadSampleBtn',
            'sampleDataStatus',
            'targetClass',
            'schedulerError',
            'loadSummary',
            'identityReview',
            'identityReviewRows',
            'studentHeaderRow',
            'studentRows',
            'autoAssignBtn',
            'assignSummary',
            'scheduleResultArea',
            'editableScheduleArea',
            'manualEditWarning',
            'blockedSlotPanel',
            'blockedSlotList',
            'blockedSlotWarning',
            'rerunAssignBtn',
            'printSchoolName',
            'printDocDate',
            'printPrincipalName',
            'printPlace',
            'printTitle',
            'printMessage',
            'printNote',
            'printFitWarning',
            'noticePreview',
            'noticePreviewControls',
            'toggleNoticePreviewBtn',
            'noticePreviewStatus',
            'teacherPreview'
        ].forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }

    function bindEvents() {
        if (elements.answerFile) {
            elements.answerFile.addEventListener('change', () => {
                updateAnswerFileName();
                loadData();
            });
        }
        const answerFileTrigger = document.querySelector('.file-button[for="answerFile"]');
        if (answerFileTrigger) {
            answerFileTrigger.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                elements.answerFile.click();
            });
        }
        elements.targetClass.addEventListener('change', () => {
            if (elements.targetClass.value === state.selectedClass) return;
            // 今のクラスの作業状態を保存してから切り替える。戻ってきたときに復元される。
            stashClassState();
            state.selectedClass = elements.targetClass.value;
            restoreClassState(state.selectedClass);
            renderClassStudents();
            renderBlockedSlotOptions();
            renderIdentityReview();
            if (state.assignments.size > 0 || state.undecided.length > 0) {
                renderAssignSummary();
                clearManualEditWarning();
                renderScheduleResult();
                renderPrintViews();
                updateTutorialStep('result');
            } else {
                hideAssignSummary();
                hideScheduleResult();
                renderPrintViews();
                updateTutorialStep('check');
            }
        });
        if (elements.studentRows) {
            elements.studentRows.addEventListener('change', event => {
                if (!event.target.matches('.student-include')) return;
                const row = event.target.closest('tr[data-key]');
                if (!row) return;
                if (event.target.checked) {
                    state.excludedStudents.delete(row.dataset.key);
                } else {
                    state.excludedStudents.add(row.dataset.key);
                }
                row.classList.toggle('is-excluded', !event.target.checked);
                const fixedSlot = row.querySelector('.fixed-slot-select');
                if (fixedSlot) {
                    fixedSlot.disabled = !event.target.checked;
                    if (!event.target.checked) fixedSlot.value = '';
                }
                // 対象が変われば古い割当は無効。再割当まで結果・印刷物を出さない。
                state.assignments.clear();
                state.undecided = [];
                state.showAllNotices = false;
                updateBlockedSlotCapacityWarning();
                renderIdentityReview();
                hideAssignSummary();
                hideScheduleResult();
                renderPrintViews();
            });
        }
        elements.autoAssignBtn.addEventListener('click', runAutoAssign);
        if (elements.rerunAssignBtn) elements.rerunAssignBtn.addEventListener('click', runAutoAssign);
        if (elements.editableScheduleArea) {
            elements.editableScheduleArea.addEventListener('change', event => {
                if (event.target.matches('.manual-slot-select')) handleManualSlotChange(event.target);
            });
        }
        if (elements.blockedSlotList) {
            elements.blockedSlotList.addEventListener('change', event => {
                if (!event.target.matches('.blocked-slot-checkbox')) return;
                if (event.target.checked) {
                    state.blockedSlots.add(event.target.value);
                } else {
                    state.blockedSlots.delete(event.target.value);
                }
                // 条件が変わった時点で古い割当は無効。再割当まで結果・印刷物を出さない。
                state.assignments.clear();
                state.undecided = [];
                state.showAllNotices = false;
                updateBlockedSlotCapacityWarning();
                hideAssignSummary();
                hideScheduleResult();
                renderPrintViews();
            });
        }
        if (elements.toggleNoticePreviewBtn) {
            elements.toggleNoticePreviewBtn.addEventListener('click', () => {
                state.showAllNotices = !state.showAllNotices;
                renderPrintViews();
            });
        }
        document.querySelectorAll('[data-print-mode]').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.printMode;
                if (!validateDocDateForPdf()) return;
                if (mode === 'notice') state.showAllNotices = true;
                renderPrintViews();
                updateTutorialStep('print');
                downloadPdf(mode);
            });
        });
        [elements.printSchoolName, elements.printDocDate, elements.printPrincipalName, elements.printPlace, elements.printTitle, elements.printMessage, elements.printNote].filter(Boolean).forEach(input => {
            // renderPrintViews を直に渡すと第1引数にInputEventが入り、既定引数の state.undecided が潰れて例外になる
            input.addEventListener('input', () => renderPrintViews());
        });
    }

    function setDefaultDate() {
        if (elements.printDocDate) {
            const now = new Date();
            elements.printDocDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
    }

    function updateAnswerFileName() {
        if (!elements.answerFileName) return;
        const file = elements.answerFile?.files?.[0];
        elements.answerFileName.textContent = file ? file.name : 'ファイルが選択されていません';
    }

    // 連打や読込中の別操作で、古い非同期読込結果が新しい状態を上書きしないようにする通し番号。
    let loadSequence = 0;

    async function loadData() {
        clearError();
        if (elements.sampleDataStatus) elements.sampleDataStatus.hidden = true;
        const token = ++loadSequence;
        const file = elements.answerFile.files[0];
        try {
            if (!file) return;
            if (!window.ExcelJS) throw new Error('Excel読込ライブラリを読み込めませんでした。ページを再読み込みしてください。');
            if (elements.answerFileName) elements.answerFileName.textContent = `${file.name}（読み込み中…）`;

            const workbook = await readWorkbook(file);
            if (token !== loadSequence) return;
            const parsed = parseWorkbook(workbook);
            const roster = parsed.roster;
            if (roster.length === 0) {
                throw new Error('このExcelに「名簿（原本）」シートがありません。「フォームを作る」ページで名簿を設定して作成した回答スプレッドシートを、.xlsx形式でダウンロードして選んでください。');
            }
            loadParsedData(roster, parsed);
            updateTutorialStep('check');
        } catch (error) {
            showError(error.message);
        } finally {
            if (token === loadSequence) {
                if (elements.answerFileName) {
                    elements.answerFileName.textContent = file ? file.name : 'ファイルが選択されていません';
                }
                // 同じファイルを修正して選び直してもchangeが発火するように毎回クリアする。
                elements.answerFile.value = '';
            }
        }
    }


    function loadParsedData(roster, parsed) {
        const duplicateKeys = findRosterDuplicateKeys(roster);
        if (duplicateKeys.length > 0) {
            throw new Error(`名簿に同じクラス・出席番号の生徒が重複しています（${duplicateKeys.slice(0, 3).join('、')}${duplicateKeys.length > 3 ? ' ほか' : ''}）。名簿を修正してから読み込み直してください。`);
        }
        state.roster = roster;
        state.responseRecords = parsed.responseRecords;
        state.slots = parsed.slots;
        state.meta = parsed.meta;
        state.assignments.clear();
        state.undecided = [];
        state.blockedSlots.clear();
        state.excludedStudents.clear();
        state.showAllNotices = false;
        state.classStates.clear();

        applyDocumentDefaults();
        applyRosterStatus();
        renderClassOptions();
        renderClassStudents();
        renderBlockedSlotOptions();
        renderIdentityReview();
        renderLoadSummary();
        renderPrintViews();
        hideAssignSummary();
        hideScheduleResult();
        document.querySelector('section[data-tutorial-step="assign"]').hidden = false;
    }

    function stashClassState() {
        if (!state.selectedClass) return;
        state.classStates.set(state.selectedClass, {
            assignments: new Map(state.assignments),
            undecided: state.undecided.slice(),
            blockedSlots: new Set(state.blockedSlots),
            showAllNotices: state.showAllNotices
        });
    }

    function restoreClassState(className) {
        const saved = state.classStates.get(className);
        state.assignments = saved ? new Map(saved.assignments) : new Map();
        state.undecided = saved ? saved.undecided.slice() : [];
        state.blockedSlots = saved ? new Set(saved.blockedSlots) : new Set();
        state.showAllNotices = saved ? saved.showAllNotices : false;
    }

    // 現在のクラスと保存済みの他クラスの割当から、生徒の決定コマを探す。きょうだいの決定日時表示に使う。
    function findAssignmentAcrossClasses(key) {
        if (state.assignments.has(key)) return state.assignments.get(key);
        for (const [className, saved] of state.classStates) {
            if (className === state.selectedClass) continue;
            if (saved.assignments.has(key)) return saved.assignments.get(key);
        }
        return null;
    }

    function findRosterDuplicateKeys(roster) {
        const seen = new Set();
        const duplicates = new Set();
        roster.forEach(student => {
            const key = makeKey(student.className, student.number);
            if (seen.has(key)) duplicates.add(`${student.className} ${student.number}番`);
            seen.add(key);
        });
        return [...duplicates];
    }

    function worksheetToDelimitedText(sheet) {
        const lines = [];
        sheet.eachRow({ includeEmpty: false }, row => {
            const values = row.values.slice(1).map(normalizeCellValue);
            if (values.some(value => String(value || '').trim() !== '')) {
                lines.push(values.map(value => String(value || '').trim()).join('\t'));
            }
        });
        return lines.join('\n');
    }

    function readWorkbook(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => {
                resolve(loadExcelWorkbook(event.target.result).catch(() => {
                    throw new Error('Excelファイルを読み取れませんでした。回答スプレッドシートを.xlsx形式でダウンロードしたものか確認してください。');
                }));
            };
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
            reader.readAsArrayBuffer(file);
        });
    }

    async function loadExcelWorkbook(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        return workbook;
    }

    function parseWorkbook(workbook) {
        const worksheets = workbook.worksheets || [];
        const conditionSheet = worksheets.find(sheet => sheet.name === '日程条件');
        if (!conditionSheet) throw new Error('Excel内に「日程条件」シートが見つかりません。新しいGASでフォームを作成した回答スプレッドシートを使ってください。');

        // 「名簿（原本）」は新しい回答Excel、「名簿」は旧バージョンで作成したもの。
        const rosterSheet = worksheets.find(sheet => ROSTER_SHEET_NAMES.includes(sheet.name));
        const schoolSettingsSheet = worksheets.find(sheet => sheet.name === '学校設定');
        const responseSheet = findResponseWorksheet(worksheets);
        if (!responseSheet) {
            throw new Error('元のGoogleフォーム回答シートが見つかりません。タイムスタンプ、生徒情報、参加日時の見出しがある回答シートを含むxlsxを選んでください。');
        }

        const conditionRows = worksheetToObjects(conditionSheet);
        const responseRows = worksheetToObjects(responseSheet);
        const condition = parseConditionRows(conditionRows);
        Object.assign(condition.meta, parseSchoolSettingsSheet(schoolSettingsSheet));
        const response = parseResponseRows(responseRows, condition);
        const roster = rosterSheet ? parseRoster(worksheetToDelimitedText(rosterSheet)) : [];
        return { ...condition, ...response, roster };
    }

    function findResponseWorksheet(worksheets) {
        const reservedNames = new Set([
            '日程条件',
            '名簿（原本）',
            '名簿',
            '学校設定',
            '使い方',
            '※編集禁止【自動変換】生徒別データ',
            '※編集禁止【フォーム回答】閲覧用',
            '希望一覧',
            '名簿照合・希望一覧',
            '要確認回答',
            '入力不備・要確認履歴'
        ]);
        const candidates = worksheets.filter(sheet => {
            return !reservedNames.has(sheet.name) && !isBlankDefaultWorksheet(sheet);
        });
        const preferredNameChecks = [
            name => name === '元データ',
            name => name.includes('フォームの回答'),
            name => /Form Responses/i.test(name)
        ];

        for (const isPreferredName of preferredNameChecks) {
            const matched = candidates.find(sheet => {
                return isPreferredName(String(sheet.name || '')) && hasResponseWorksheetSchema(sheet);
            });
            if (matched) return matched;
        }

        return candidates.find(hasResponseWorksheetSchema) || null;
    }

    function hasResponseWorksheetSchema(sheet) {
        const headers = sheet.getRow(1).values
            .slice(1)
            .map(value => String(normalizeCellValue(value) || '').trim())
            .filter(Boolean);
        const headerSet = new Set(headers);
        const hasTimestamp = ['タイムスタンプ', 'Timestamp', '送信日時'].some(header => headerSet.has(header));
        const hasCurrentStudentFields = [
            'お子さまの学級',
            'お子さまの出席番号',
            'お子さまの氏名'
        ].every(header => headerSet.has(header));
        const hasPrefixedStudentFields = [
            '1人目_学級',
            '1人目_出席番号',
            '1人目_生徒氏名'
        ].every(header => headerSet.has(header));
        const hasLegacyStudentFields = [
            '学級',
            '出席番号',
            '生徒氏名'
        ].every(header => headerSet.has(header));
        const hasScheduleField = headers.some(header => /^参加でき(ない|る)日時/.test(header));

        return hasTimestamp && (hasCurrentStudentFields || hasPrefixedStudentFields || hasLegacyStudentFields) && hasScheduleField;
    }

    function isBlankDefaultWorksheet(sheet) {
        if (!['シート1', 'Sheet1'].includes(sheet.name)) return false;
        let hasValue = false;
        sheet.eachRow(row => {
            row.eachCell({ includeEmpty: false }, cell => {
                if (cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
                    hasValue = true;
                }
            });
        });
        return !hasValue;
    }

    function parseSchoolSettingsSheet(sheet) {
        if (!sheet) return {};
        const keyMap = {
            '学校名': 'document.schoolName',
            '校長名': 'document.principalName',
            '案内文書のタイトル': 'document.noticeTitle',
            '配布予定日': 'document.noticeDeliveryDate',
            '懇談場所': 'document.noticePlace',
            '決定通知の本文': 'document.noticeMessage',
            'お願い・連絡事項': 'document.noticeNote',
            // 旧バージョンで作成した回答Excelの見出し
            '持ち物・備考': 'document.noticeNote'
        };
        const settings = {};
        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;
            const label = String(normalizeCellValue(row.getCell(1).value) || '').trim();
            const value = normalizeCellValue(row.getCell(2).value);
            if (keyMap[label]) settings[keyMap[label]] = value;
        });
        return settings;
    }

    function worksheetToObjects(sheet) {
        const rows = [];
        const headers = [];
        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            const values = row.values.slice(1).map(normalizeCellValue);
            if (rowNumber === 1) {
                values.forEach((value, index) => {
                    headers[index] = String(value || '').trim();
                });
                return;
            }
            const object = {};
            headers.forEach((header, index) => {
                if (header) object[header] = values[index] || '';
            });
            if (Object.values(object).some(value => String(value).trim() !== '')) rows.push(object);
        });
        return rows;
    }

    // Excelの日付はDateにも文字列にもなり得るため、input[type=date]が受け取れる形へ揃える。
    function toInputDate(value) {
        if (value instanceof Date) {
            return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
        }
        const text = String(value || '').trim();
        const matched = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (!matched) return '';
        return `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
    }

    function normalizeCellValue(value) {
        if (value instanceof Date) return value;
        if (value && typeof value === 'object') {
            if (value.text) return value.text;
            if (value.result !== undefined) return value.result;
            if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
            return String(value);
        }
        return value === undefined || value === null ? '' : value;
    }

    function parseConditionRows(rows) {
        const meta = {};
        const classes = [];
        const slots = [];
        rows.forEach(row => {
            if (row.section === 'meta') meta[row.key] = row.value;
            if (row.section === 'class') classes.push(row.className || row.value);
            if (row.section === 'slot') {
                slots.push({
                    id: row.slotId,
                    date: row.date,
                    dateLabel: row.dateLabel,
                    start: row.start,
                    end: row.end,
                    display: row.display,
                    label: `${row.dateLabel} ${row.display}`,
                    sort: Number(row.sort) || slots.length + 1
                });
            }
        });
        slots.sort((a, b) => a.sort - b.sort);
        if (slots.length === 0) throw new Error('日程条件シートに時間枠が見つかりません。');
        meta.responseMode = meta.responseMode || 'checked_unavailable';
        return { meta, classes, slots };
    }

    function parseResponseRows(rows, condition) {
        const responseRecords = [];

        rows.forEach((row, rowIndex) => {
            const timestamp = parseTimestamp(row['タイムスタンプ'] || row['Timestamp'] || row['送信日時'] || '');
            const selectedDisplays = readSelectedSlotDisplays(row);
            const householdStudents = readHouseholdStudents(row);
            const remark = readResponseRemark(row, condition);
            const unavailable = new Set();
            const available = new Set();

            if (condition.meta.responseMode === 'checked_available') {
                selectedDisplays.forEach(display => available.add(display));
            } else {
                selectedDisplays.forEach(display => unavailable.add(display));
                condition.slots.forEach(slot => {
                    const key = slotSelectionKey(slot);
                    if (!isSlotSelected(unavailable, slot)) available.add(key);
                });
            }

            householdStudents.forEach(student => {
                const key = makeKey(student.className, student.number);
                const record = {
                    ...student,
                    key,
                    timestamp,
                    rowIndex,
                    householdStudents,
                    remark,
                    availableDisplays: available,
                    unavailableDisplays: unavailable,
                    raw: row
                };
                responseRecords.push(record);
            });
        });

        return { responseRecords };
    }

    function readHouseholdStudents(row) {
        const students = [];
        for (let index = 1; index <= 3; index += 1) {
            const className = normalizeText(readStudentCell(row, index, '学級'));
            const number = normalizeNumber(readStudentCell(row, index, '出席番号'));
            const name = normalizeText(readStudentCell(row, index, '氏名'));
            if (className || number || name) {
                students.push({ className, number, name });
            }
        }
        return students;
    }

    function readStudentCell(row, index, kind) {
        // 質問名の世代順に探す: 「お子さまの学級」→「1人目_学級」→ 最初期の「学級」（1人目のみ）
        const childPrefix = index === 1 ? 'お子さまの' : `${index}人目のお子さまの`;
        const legacyKind = kind === '氏名' ? '生徒氏名' : kind;
        const candidates = [`${childPrefix}${kind}`, `${index}人目_${legacyKind}`];
        if (index === 1) candidates.push(legacyKind);
        for (const key of candidates) {
            if (row[key] !== undefined && row[key] !== '') return row[key];
        }
        return '';
    }

    function readResponseRemark(row, condition) {
        // フォーム作成時の備考欄タイトルは日程条件シートのremarkTitleに保存される。
        // 旧版で作成した回答Excelにはないため、既定タイトル「備考」へフォールバックする。
        const remarkTitle = normalizeText(condition.meta.remarkTitle || '');
        if (remarkTitle && row[remarkTitle] !== undefined) return normalizeText(row[remarkTitle]);
        if (row['備考'] !== undefined) return normalizeText(row['備考']);
        return '';
    }

    function readSelectedSlotDisplays(row) {
        const displays = new Set();
        Object.keys(row).forEach(key => {
            if (!/^参加でき(ない|る)日時/.test(key)) return;
            const dateMatch = key.match(/（(.+)）$/);
            splitCheckboxValue(row[key]).forEach(value => {
                displays.add(dateMatch ? `${dateMatch[1]}|${value}` : value);
            });
        });
        return displays;
    }

    function splitCheckboxValue(value) {
        return String(value || '')
            .split(/\s*,\s*/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function parseRoster(text) {
        const rows = parseDelimitedText(String(text || ''));
        if (rows.length === 0) return [];
        const first = rows[0].join(',');
        const hasHeader = /学級|学年|クラス/.test(first) && /番号/.test(first);
        const body = hasHeader ? rows.slice(1) : rows;
        const header = hasHeader ? rows[0] : ['学級', '出席番号', '生徒氏名'];
        const gradeIndex = findOptionalHeaderIndex(header, ['学年']);
        const fullClassIndex = findOptionalHeaderIndex(header, ['学級']);
        const classIndex = findOptionalHeaderIndex(header, ['クラス', '組']);
        const numberIndex = findHeaderIndex(header, ['出席番号', '番号']);
        const nameIndex = findHeaderIndex(header, ['生徒氏名', '氏名', '名前']);

        return body.map(cells => {
            const className = fullClassIndex >= 0
                ? normalizeText(cells[fullClassIndex] || '')
                : buildClassName(cells[gradeIndex], cells[classIndex]);
            return {
                className,
                number: normalizeNumber(cells[numberIndex] || ''),
                name: normalizeText(cells[nameIndex] || '')
            };
        }).filter(student => student.className && student.number && student.name);
    }

    // 引用符付きCSV（Excel出力の「"山田, 太郎"」等）に対応した区切りテキストのパース。
    function parseDelimitedText(text) {
        const delimiter = text.includes('\t') ? '\t' : ',';
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i += 1) {
            const char = text[i];
            if (inQuotes) {
                if (char === '"') {
                    if (text[i + 1] === '"') {
                        cell += '"';
                        i += 1;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cell += char;
                }
            } else if (char === '"' && cell.trim() === '') {
                cell = '';
                inQuotes = true;
            } else if (char === delimiter) {
                row.push(cell);
                cell = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && text[i + 1] === '\n') i += 1;
                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
            } else {
                cell += char;
            }
        }
        row.push(cell);
        rows.push(row);
        return rows
            .map(cells => cells.map(value => value.trim()))
            .filter(cells => cells.some(value => value !== ''));
    }

    function findOptionalHeaderIndex(header, candidates) {
        return header.findIndex(cell => candidates.some(candidate => String(cell).includes(candidate)));
    }

    function findHeaderIndex(header, candidates) {
        const index = header.findIndex(cell => candidates.some(candidate => String(cell).includes(candidate)));
        return index >= 0 ? index : candidates[0] === '学級' ? 0 : candidates[0] === '出席番号' ? 1 : 2;
    }

    function buildClassName(gradeValue, classValue) {
        const grade = normalizeNumber(gradeValue);
        const classNo = normalizeNumber(classValue);
        if (!grade || !classNo) return '';
        return `${grade}年${classNo}組`;
    }

    function applyRosterStatus() {
        state.students = new Map();
        state.duplicates = [];
        state.externalResponses = [];
        state.rosterOnly = [];

        state.responseRecords.forEach(sourceRecord => {
            const record = reconcileResponseIdentity(sourceRecord, state.roster);
            if (!record.matchedRoster) {
                state.externalResponses.push(record);
                return;
            }

            const current = state.students.get(record.key);
            if (!current || record.timestamp >= current.timestamp) {
                if (current) state.duplicates.push(current);
                state.students.set(record.key, record);
            } else {
                state.duplicates.push(record);
            }
        });

        state.roster.forEach(rosterStudent => {
            const key = makeKey(rosterStudent.className, rosterStudent.number);
            const response = state.students.get(key);
            if (response) {
                response.rosterName = rosterStudent.name;
            } else {
                state.rosterOnly.push({ ...rosterStudent, key });
            }
        });

        // 照合矛盾の回答に関わった生徒のうち、有効な回答がない生徒へ印を付ける。
        // 未回答理由の表示で「回答がない」と「照合できない回答がある」を区別するため。
        state.conflictKeys = new Set();
        state.externalResponses.forEach(record => {
            (record.conflictRosterKeys || []).forEach(key => {
                if (!state.students.has(key)) state.conflictKeys.add(key);
            });
        });
    }

    function reconcileResponseIdentity(sourceRecord, roster) {
        const record = {
            ...sourceRecord,
            enteredClassName: sourceRecord.className,
            enteredNumber: sourceRecord.number,
            enteredName: sourceRecord.name,
            matchedRoster: null,
            numberMismatch: false,
            nameMismatch: false
        };
        const classRoster = roster.filter(student => student.className === record.className);
        const exactNumber = classRoster.find(student => student.number === record.number);
        const nameMatches = classRoster.filter(student => normalizeName(student.name) === normalizeName(record.name));

        if (nameMatches.length === 1) {
            // 氏名一致の生徒と入力された出席番号の生徒が別人の場合は矛盾。自動補正せず「要確認」にする。
            if (exactNumber && exactNumber.number !== nameMatches[0].number) {
                // 氏名で特定できた生徒と番号で特定できた生徒が異なる→自動補正不可
                record.matchedRoster = null;
                record.conflictIdentity = true;
                record.conflictRosterKeys = [nameMatches[0], exactNumber]
                    .map(student => makeKey(student.className, student.number));
            } else {
                record.matchedRoster = nameMatches[0];
                record.numberMismatch = nameMatches[0].number !== record.number;
            }
        } else if (nameMatches.length > 1) {
            // 同姓同名が複数いる場合、番号一致がその中の1人なら確定。別人を指すなら矛盾として要確認。
            if (exactNumber && nameMatches.some(student => student.number === exactNumber.number)) {
                record.matchedRoster = exactNumber;
            } else {
                record.matchedRoster = null;
                record.conflictIdentity = true;
                record.conflictRosterKeys = nameMatches.concat(exactNumber ? [exactNumber] : [])
                    .map(student => makeKey(student.className, student.number));
            }
        } else if (exactNumber) {
            record.matchedRoster = exactNumber;
            record.nameMismatch = normalizeName(exactNumber.name) !== normalizeName(record.name);
        }

        if (record.matchedRoster) {
            record.className = record.matchedRoster.className;
            record.number = record.matchedRoster.number;
            record.key = makeKey(record.className, record.number);
            record.rosterName = record.matchedRoster.name;
        }
        return record;
    }

    // ①と同じ並び。「◯年◯組」を学年・クラス番号順にし、特別支援学級などは名前順で末尾にまとめる。
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

    function renderClassOptions() {
        const classes = [...new Set(state.roster.map(student => student.className))].sort(compareClassName);
        elements.targetClass.innerHTML = classes.map(className => `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`).join('');
        elements.targetClass.disabled = classes.length === 0;
        state.selectedClass = classes[0] || '';
        elements.targetClass.value = state.selectedClass;
        elements.autoAssignBtn.disabled = !state.selectedClass;
    }

    function renderBlockedSlotOptions() {
        if (!elements.blockedSlotPanel || !elements.blockedSlotList) return;
        if (state.slots.length === 0) {
            elements.blockedSlotPanel.hidden = true;
            elements.blockedSlotList.innerHTML = '';
            if (elements.blockedSlotWarning) elements.blockedSlotWarning.hidden = true;
            return;
        }

        elements.blockedSlotPanel.hidden = false;
        // 決定表と同じ「時刻×日」のマトリクスで表示する。コマをクリックすると空け指定になる。
        const dates = [];
        const times = [];
        state.slots.forEach(slot => {
            if (!dates.includes(slot.dateLabel)) dates.push(slot.dateLabel);
            if (!times.includes(slot.display)) times.push(slot.display);
        });
        const header = dates.map(date => `<th scope="col">${escapeHtml(shortDateLabel(date))}</th>`).join('');
        const rows = times.map(time => {
            const cells = dates.map(date => {
                const slot = state.slots.find(item => item.dateLabel === date && item.display === time);
                if (!slot) return '<td class="is-empty">－</td>';
                const checked = state.blockedSlots.has(slot.id);
                return `<td class="blocked-slot-cell-td">
                    <label class="blocked-slot-cell">
                        <input type="checkbox" class="blocked-slot-checkbox" value="${escapeHtml(slot.id)}" ${checked ? 'checked' : ''}
                            aria-label="${escapeHtml(shortDateLabel(date))} ${escapeHtml(slot.display)} を空ける">
                        <span>空ける</span>
                    </label>
                </td>`;
            }).join('');
            return `<tr><th scope="row">${escapeHtml(time)}</th>${cells}</tr>`;
        }).join('');
        elements.blockedSlotList.innerHTML = `
            <div class="table-scroll">
                <table class="scheduler-table blocked-slot-table">
                    <thead><tr><th scope="col">時刻</th>${header}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        updateBlockedSlotCapacityWarning();
    }

    // 画面表示用の短い日付。「2026年7月14日（火）」の年部分を省く。
    function shortDateLabel(dateLabel) {
        return String(dateLabel || '').replace(/^\d{4}年/, '');
    }

    function updateBlockedSlotCapacityWarning() {
        if (!elements.blockedSlotWarning) return true;
        const totalStudents = getAssignableStudents().length;
        const usableSlots = Math.max(0, state.slots.length - state.blockedSlots.size);
        if (state.slots.length > 0 && totalStudents > usableSlots) {
            elements.blockedSlotWarning.hidden = false;
            elements.blockedSlotWarning.textContent = `対象生徒 ${totalStudents}名に対して、使用できるコマが ${usableSlots}枠しかありません。空けたいコマを減らすか、日程枠を増やしてください。`;
            return false;
        }
        elements.blockedSlotWarning.hidden = true;
        elements.blockedSlotWarning.textContent = '';
        return true;
    }

    function renderClassStudents() {
        renderStudentHeader();
        if (!state.selectedClass) {
            elements.studentRows.innerHTML = `<tr><td colspan="${8 + state.slots.length}">今回組むクラスを選んでください。</td></tr>`;
            return;
        }

        const students = getSelectedRosterStudents();
        elements.studentRows.innerHTML = students.map(student => {
            const response = state.students.get(student.key);
            const siblings = response ? response.householdStudents
                .map(item => reconcileResponseIdentity(item, state.roster))
                .filter(item => item.key !== student.key)
                .map(item => {
                    const displayStudent = item.matchedRoster || item;
                    const label = `${escapeHtml(displayStudent.className)} ${escapeHtml(displayStudent.number)}番 ${escapeHtml(displayStudent.name)}`;
                    // 別クラスで割当済みのきょうだいは決定日時を添える。近いコマへ寄せる手がかりになる。
                    const decided = item.key ? findAssignmentAcrossClasses(item.key) : null;
                    return decided
                        ? `${label}<br><small class="sibling-decided"><i class="fas fa-circle-check"></i> ${escapeHtml(shortDateLabel(decided.slot.dateLabel))} ${escapeHtml(decided.slot.display)} に決定済み</small>`
                        : label;
                })
                .join('<br>') : '';
            const status = response
                ? (response.numberMismatch ? '番号補正済み' : response.nameMismatch ? '氏名要確認' : '回答済み')
                : (state.conflictKeys.has(student.key) ? '照合要確認' : '未回答');
            const remark = response && response.remark ? escapeHtml(response.remark) : '';
            // 固定・手動で割当済みのコマは、クラスを切り替えて戻ってきても選択欄に反映する。
            const assignment = state.assignments.get(student.key);
            const fixedSlotId = assignment && assignment.fixed ? assignment.slot.id : '';
            const options = ['<option value="">自動に任せる</option>'].concat(state.slots.map(slot => `<option value="${escapeHtml(slot.id)}"${slot.id === fixedSlotId ? ' selected' : ''}>${escapeHtml(shortDateLabel(slot.dateLabel))} ${escapeHtml(slot.display)}</option>`)).join('');
            const excluded = state.excludedStudents.has(student.key);
            return `<tr data-key="${escapeHtml(student.key)}"${excluded ? ' class="is-excluded"' : ''}>
                <td class="include-cell">
                    <input type="checkbox" class="student-include" ${excluded ? '' : 'checked'}
                        aria-label="${escapeHtml(student.number)}番 ${escapeHtml(student.name)} の懇談を組む">
                </td>
                <td>${escapeHtml(student.number)}</td>
                <td>${escapeHtml(student.name)}</td>
                <td>${escapeHtml(status)}</td>
                <td>${siblings || '-'}</td>
                <td class="remark-cell">${remark || '-'}</td>
                <td><select class="fixed-slot-select"${excluded ? ' disabled' : ''}>${options}</select></td>
                <td class="warning-cell"></td>
                ${state.slots.map(slot => buildPreferenceCell(response, slot)).join('')}
            </tr>`;
        }).join('') || `<tr><td colspan="${8 + state.slots.length}">このクラスの名簿がありません。</td></tr>`;
    }

    function renderStudentHeader() {
        if (!elements.studentHeaderRow) return;
        const slotHeaders = state.slots.map(slot => `
            <th class="preference-slot-header" title="${escapeHtml(slot.label)}">
                <span>${escapeHtml(shortDateLabel(slot.dateLabel))}</span>
                <small>${escapeHtml(slot.display)}</small>
            </th>
        `).join('');
        elements.studentHeaderRow.innerHTML = `
            <th scope="col" title="チェックを外すと、この生徒の懇談は組みません">対象</th>
            <th scope="col">番号</th>
            <th scope="col">氏名</th>
            <th scope="col">回答状況</th>
            <th scope="col">兄弟姉妹</th>
            <th scope="col">保護者からの備考</th>
            <th scope="col">固定日時</th>
            <th scope="col">警告</th>
            ${slotHeaders}`;
    }

    function buildPreferenceCell(response, slot) {
        if (!response) {
            return `<td class="preference-cell is-no-response" title="${escapeHtml(slot.label)}は回答なし">未</td>`;
        }
        const available = isSlotAvailable(response, slot);
        const label = available ? '参加可能' : '参加不可';
        const mark = available ? '○' : '×';
        return `<td class="preference-cell ${available ? 'is-available' : 'is-unavailable'}" title="${escapeHtml(slot.label)}：${label}">${mark}</td>`;
    }

    function renderIdentityReview() {
        if (!state.selectedClass) {
            elements.identityReview.hidden = true;
            return;
        }

        const rows = getAssignableStudents().map(student => {
            const response = state.students.get(student.key);
            if (!response) {
                return `<tr>
                    <td>${escapeHtml(student.number)}番 ${escapeHtml(student.name)}</td>
                    <td>回答なし</td>
                    <td><span class="identity-status is-unanswered">未回答</span></td>
                </tr>`;
            }

            let result = '<span class="identity-status is-ok">一致</span>';
            if (response.numberMismatch) {
                result = `<span class="identity-status is-corrected">番号を自動補正</span><br>
                    ${escapeHtml(response.enteredNumber)}番から${escapeHtml(student.number)}番へ補正`;
            } else if (response.nameMismatch) {
                result = '<span class="identity-status is-warning">氏名を確認</span><br>名簿と入力氏名が一致しません';
            }

            return `<tr>
                <td>${escapeHtml(student.number)}番 ${escapeHtml(student.name)}</td>
                <td>${escapeHtml(response.enteredNumber)}番 ${escapeHtml(response.enteredName)}</td>
                <td>${result}</td>
            </tr>`;
        });

        state.externalResponses
            .filter(response => response.enteredClassName === state.selectedClass)
            .forEach(response => {
                const statusHtml = response.conflictIdentity
                    ? '<span class="identity-status is-warning">要確認</span><br>氏名と出席番号が別の生徒を指しています'
                    : '<span class="identity-status is-error">名簿と照合できません</span>';
                rows.push(`<tr>
                    <td>${response.conflictIdentity ? '要確認（照合矛盾）' : '該当する生徒なし'}</td>
                    <td>${escapeHtml(response.enteredNumber || '-')}番 ${escapeHtml(response.enteredName || '-')}</td>
                    <td>${statusHtml}</td>
                </tr>`);
            });

        elements.identityReview.hidden = false;
        elements.identityReviewRows.innerHTML = rows.join('') || '<tr><td colspan="3">このクラスの名簿がありません。</td></tr>';
    }

    function renderLoadSummary() {
        const answered = state.roster.filter(student => state.students.has(makeKey(student.className, student.number))).length;
        const corrected = [...state.students.values()].filter(response => response.numberMismatch).length;
        const nameWarnings = [...state.students.values()].filter(response => response.nameMismatch).length;
        elements.loadSummary.hidden = false;
        elements.loadSummary.innerHTML = `
            <strong>読込結果</strong>
            <span>名簿 ${state.roster.length}名</span>
            <span>回答済み ${answered}名</span>
            <span>未回答 ${state.rosterOnly.length}名</span>
            <span>重複回答 ${state.duplicates.length}件</span>
            <span>番号補正 ${corrected}件</span>
            <span>氏名確認 ${nameWarnings}件</span>
            <span>照合不能 ${state.externalResponses.length}件</span>
            <span>時間枠 ${state.slots.length}枠</span>
            <span>回答方式 ${escapeHtml(responseModeLabel())}</span>
        `;
        if (nameWarnings > 0) {
            const guidance = document.createElement('p');
            guidance.className = 'load-summary-guidance';
            guidance.textContent = '下の「名簿と回答を照合する」で該当行を確認してください。';
            elements.loadSummary.appendChild(guidance);
        }
    }

    function applyDocumentDefaults() {
        // ①で決めた配布予定日を文書日付の初期値にする。決定通知の本文の時候の挨拶と揃えるため。
        const deliveryDate = toInputDate(state.meta['document.noticeDeliveryDate']);
        if (deliveryDate && elements.printDocDate) elements.printDocDate.value = deliveryDate;

        const mappings = [
            ['document.schoolName', elements.printSchoolName],
            ['document.principalName', elements.printPrincipalName],
            ['document.noticePlace', elements.printPlace],
            ['document.noticeTitle', elements.printTitle],
            ['document.noticeMessage', elements.printMessage],
            ['document.noticeNote', elements.printNote]
        ];
        mappings.forEach(([key, element]) => {
            if (element && state.meta[key]) element.value = state.meta[key];
        });
    }

    function runAutoAssign() {
        clearError();
        state.assignments.clear();
        state.showAllNotices = false;
        updateTutorialStep('assign');
        document.querySelectorAll('.warning-cell').forEach(cell => {
            cell.textContent = '';
        });

        const occupied = new Set(state.blockedSlots);
        const selectedStudents = getAssignableStudents();
        updateBlockedSlotCapacityWarning();
        const rows = [...elements.studentRows.querySelectorAll('tr[data-key]')];

        rows.forEach(row => {
            const key = row.dataset.key;
            const slotId = row.querySelector('.fixed-slot-select').value;
            if (!slotId) return;
            const student = selectedStudents.find(item => item.key === key);
            const slot = state.slots.find(item => item.id === slotId);
            const response = state.students.get(key);
            if (!slot || !student) return;
            if (state.blockedSlots.has(slot.id)) {
                row.querySelector('.warning-cell').textContent = '担任が空けたいコマ';
                return;
            }
            if (occupied.has(slot.id)) {
                row.querySelector('.warning-cell').textContent = '同じコマに別の生徒を固定済み（自動割当に回します）';
                return;
            }
            state.assignments.set(key, { student, slot, fixed: true });
            occupied.add(slot.id);
            if (response && !isSlotAvailable(response, slot)) {
                row.querySelector('.warning-cell').textContent = '保護者希望と矛盾';
            }
        });

        const pending = selectedStudents
            .filter(student => !state.assignments.has(student.key))
            .map(student => {
                const response = state.students.get(student.key);
                const candidates = response ? availableCandidates(response, occupied) : [];
                return { student, response, candidates };
            })
            .sort(comparePendingStudent);

        const undecided = [];
        const remaining = pending.slice();
        while (remaining.length > 0) {
            const decorated = remaining
                .map(item => ({
                    ...item,
                    candidates: item.response ? availableCandidates(item.response, occupied) : []
                }))
                .sort(comparePendingStudent);
            const item = decorated[0];
            const index = remaining.findIndex(candidate => candidate.student.key === item.student.key);
            remaining.splice(index, 1);

            if (!item.response || item.candidates.length === 0) {
                undecided.push(createUndecidedEntry(item.student, item.response, occupied));
                continue;
            }

            const slot = chooseSlotForStudent(item, decorated.slice(1), occupied);
            if (!slot) {
                undecided.push(createUndecidedEntry(item.student, item.response, occupied, '自動割当で選べるコマが見つかりませんでした'));
                continue;
            }
            state.assignments.set(item.student.key, { student: item.student, slot, fixed: false });
            occupied.add(slot.id);
        }

        // 貪欲法で決まらなかった生徒を、割当済みの生徒を別の希望コマへずらして救済する。
        // 全員の希望条件はそのまま守られるため、組み合わせ上可能な限り未決定が減る。
        const rescuedKeys = rescueUndecidedByReassignment(undecided);
        state.undecided = undecided.filter(entry => !rescuedKeys.has(entry.student.key));
        renderAssignSummary();
        clearManualEditWarning();
        renderScheduleResult();
        renderPrintViews(state.undecided);
        if (elements.scheduleResultArea) {
            elements.scheduleResultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        updateTutorialStep('result');
    }

    // 未決定の生徒ごとに増加路探索を行う。固定・手動の割当と「担任が空けたいコマ」は動かさない。
    function rescueUndecidedByReassignment(undecidedEntries) {
        const slotOwner = new Map();
        state.assignments.forEach((item, key) => slotOwner.set(item.slot.id, key));
        const rescued = new Set();

        undecidedEntries.forEach(entry => {
            const response = state.students.get(entry.student.key);
            if (!response) return;
            if (findReassignmentPath(entry.student, response, slotOwner, new Set())) {
                rescued.add(entry.student.key);
            }
        });
        return rescued;
    }

    function findReassignmentPath(student, response, slotOwner, visitedSlotIds) {
        for (const slot of state.slots) {
            if (state.blockedSlots.has(slot.id)) continue;
            if (visitedSlotIds.has(slot.id)) continue;
            if (!isSlotAvailable(response, slot)) continue;
            visitedSlotIds.add(slot.id);

            const ownerKey = slotOwner.get(slot.id);
            if (ownerKey !== undefined) {
                const owner = state.assignments.get(ownerKey);
                if (!owner || owner.fixed) continue;
                const ownerResponse = state.students.get(ownerKey);
                if (!ownerResponse) continue;
                if (!findReassignmentPath(owner.student, ownerResponse, slotOwner, visitedSlotIds)) continue;
            }

            state.assignments.set(student.key, { student, slot, fixed: false });
            slotOwner.set(slot.id, student.key);
            return true;
        }
        return false;
    }

    function renderAssignSummary() {
        if (!elements.assignSummary) return;
        elements.assignSummary.hidden = false;
        const assignedSlotIds = new Set([...state.assignments.values()].map(item => item.slot.id));
        const blockedFree = [...state.blockedSlots].filter(id => !assignedSlotIds.has(id)).length;
        const blockedUsed = state.blockedSlots.size - blockedFree;
        elements.assignSummary.innerHTML = `
            <strong>割当結果</strong>
            <span>決定 ${state.assignments.size}名</span>
            <span>未決定 ${state.undecided.length}名</span>
            <span>空けたコマ ${blockedFree}枠${blockedUsed > 0 ? `（${blockedUsed}枠は手動配置で使用中）` : ''}</span>
            <span>固定・手動 ${[...state.assignments.values()].filter(item => item.fixed).length}名</span>
        `;
    }

    function hideAssignSummary() {
        if (!elements.assignSummary) return;
        elements.assignSummary.hidden = true;
        elements.assignSummary.innerHTML = '';
    }

    function availableCandidates(response, occupied) {
        return state.slots.filter(slot => !occupied.has(slot.id) && isSlotAvailable(response, slot));
    }

    function comparePendingStudent(a, b) {
        return a.candidates.length - b.candidates.length
            || candidateSpreadScore(a.candidates) - candidateSpreadScore(b.candidates)
            || Number(a.student.number) - Number(b.student.number)
            || a.student.name.localeCompare(b.student.name, 'ja');
    }

    function candidateSpreadScore(candidates) {
        if (candidates.length === 0) return Number.POSITIVE_INFINITY;
        return candidates.reduce((sum, slot) => sum + (Number(slot.sort) || 0), 0) / candidates.length;
    }

    function chooseSlotForStudent(item, otherPending, occupied) {
        const slotDemand = new Map();
        const load = currentAssignmentLoad();
        otherPending.forEach(other => {
            if (!other.response) return;
            availableCandidates(other.response, occupied).forEach(slot => {
                slotDemand.set(slot.id, (slotDemand.get(slot.id) || 0) + 1);
            });
        });

        return item.candidates
            .slice()
            .sort((a, b) => {
                const scoreDiff = slotBalanceScore(a, slotDemand, load) - slotBalanceScore(b, slotDemand, load);
                if (scoreDiff !== 0) return scoreDiff;
                return (Number(a.sort) || 0) - (Number(b.sort) || 0);
            })[0];
    }

    function currentAssignmentLoad() {
        const dateLoad = new Map();
        const timeLoad = new Map();
        state.assignments.forEach(item => {
            dateLoad.set(item.slot.date, (dateLoad.get(item.slot.date) || 0) + 1);
            timeLoad.set(item.slot.display, (timeLoad.get(item.slot.display) || 0) + 1);
        });
        return { dateLoad, timeLoad };
    }

    function slotBalanceScore(slot, slotDemand, load) {
        const dateLoad = load.dateLoad.get(slot.date) || 0;
        const timeLoad = load.timeLoad.get(slot.display) || 0;
        const demand = slotDemand.get(slot.id) || 0;
        // 日付の偏りを最優先で抑え、同じ時刻の偏りと他生徒との競合を次に見る。
        return dateLoad * 100 + timeLoad * 12 + demand * 2 + (Number(slot.sort) || 0) / 1000;
    }

    function isSlotAvailable(response, slot) {
        if (state.meta.responseMode === 'checked_available') {
            return isSlotSelected(response.availableDisplays, slot);
        }
        return !isSlotSelected(response.unavailableDisplays, slot);
    }

    function slotSelectionKey(slot) {
        return `${slot.dateLabel}|${slot.display}`;
    }

    function isSlotSelected(selection, slot) {
        return selection.has(slotSelectionKey(slot)) || selection.has(slot.display);
    }

    function renderScheduleResult() {
        if (!elements.scheduleResultArea || !elements.editableScheduleArea) return;
        const assignments = [...state.assignments.values()].sort(compareAssignment);
        const decided = assignments.length;
        const total = getAssignableStudents().length;
        const undecidedRows = state.undecided.map(formatUndecidedListItem).join('');

        elements.scheduleResultArea.hidden = false;
        document.querySelector('section[data-tutorial-step="print"]').hidden = false;
        const printArea = document.getElementById('printArea');
        if (printArea) printArea.hidden = false;
        elements.editableScheduleArea.innerHTML = `
            <div class="scheduler-summary schedule-result-summary">
                <strong>決定表</strong>
                <span>対象 ${total}名</span>
                <span>決定 ${decided}名</span>
                <span>未決定 ${state.undecided.length}名</span>
                <span>手動調整 ${assignments.filter(item => item.manual).length}名</span>
            </div>
            <p class="section-description">各コマの選択欄で生徒を入れ替えられます。希望と合わない日時に入れた場合は、警告を表示します。</p>
            ${buildEditableScheduleMatrix(assignments)}
            ${undecidedRows ? `<div class="undecided-panel"><strong>未決定の生徒</strong><ul>${undecidedRows}</ul></div>` : ''}`;
    }

    function hideScheduleResult() {
        if (elements.scheduleResultArea) elements.scheduleResultArea.hidden = true;
        if (elements.editableScheduleArea) elements.editableScheduleArea.innerHTML = '';
        clearManualEditWarning();
    }

    function buildEditableScheduleMatrix(assignments) {
        const dates = [];
        const times = [];
        state.slots.forEach(slot => {
            if (!dates.includes(slot.dateLabel)) dates.push(slot.dateLabel);
            if (!times.includes(slot.display)) times.push(slot.display);
        });

        const students = getAssignableStudents();
        const assignmentBySlotId = new Map(assignments.map(item => [item.slot.id, item]));
        // 見出しの並びは dateLabel で作っているので、表示だけ和暦に置き換える。
        const eraByDateLabel = new Map(state.slots.map(slot => [slot.dateLabel, printDateLabel(slot)]));
        const header = dates.map(date => `<th scope="col">${escapeHtml(eraByDateLabel.get(date) || date)}</th>`).join('');
        const rows = times.map(time => {
            const cells = dates.map(date => {
                const slot = state.slots.find(item => item.dateLabel === date && item.display === time);
                if (!slot) return '<td class="is-empty">－</td>';
                const assignment = assignmentBySlotId.get(slot.id);
                const selectedKey = assignment ? assignment.student.key : '';
                const warningLabel = assignment ? assignmentWarningLabel(assignment) : '';
                return `<td class="${warningLabel ? 'is-preference-warning' : ''}">
                    <label class="manual-slot-label">
                        <span class="visually-hidden">${escapeHtml(slot.label)}に入れる生徒</span>
                        <select class="manual-slot-select" data-slot-id="${escapeHtml(slot.id)}">
                            ${buildStudentOptions(students, selectedKey)}
                        </select>
                    </label>
                    ${warningLabel ? `<small class="manual-warning-label">${escapeHtml(warningLabel)}</small>` : ''}
                </td>`;
            }).join('');
            return `<tr><th scope="row">${escapeHtml(time)}</th>${cells}</tr>`;
        }).join('');

        return `<div class="schedule-matrix-wrap editable-schedule-wrap">
            <table class="scheduler-table schedule-matrix editable-schedule-table">
                <thead><tr><th scope="col">時刻</th>${header}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    function buildStudentOptions(students, selectedKey) {
        return ['<option value="">空き</option>'].concat(students.map(student => {
            const selected = student.key === selectedKey ? ' selected' : '';
            return `<option value="${escapeHtml(student.key)}"${selected}>${escapeHtml(student.number)}番 ${escapeHtml(student.name)}</option>`;
        })).join('');
    }

    function handleManualSlotChange(select) {
        const slot = state.slots.find(item => item.id === select.dataset.slotId);
        if (!slot) return;

        const selectedStudents = getAssignableStudents();
        const nextKey = select.value;
        const currentAssignment = findAssignmentBySlotId(slot.id);
        if (currentAssignment) {
            state.assignments.delete(currentAssignment.student.key);
            addUndecided(currentAssignment.student);
        }

        if (nextKey) {
            const student = selectedStudents.find(item => item.key === nextKey);
            if (!student) return;
            state.assignments.delete(nextKey);
            state.assignments.set(nextKey, { student, slot, fixed: true, manual: true });
            removeUndecided(nextKey);
            showManualPreferenceWarning(student, slot);
        } else {
            clearManualEditWarning();
        }

        renderScheduleResult();
        renderAssignSummary();
        renderPrintViews(state.undecided);
        // 手動調整を「固定日時」欄へ反映する。次の自動割当は固定欄から読むため、
        // これを怠ると「もう一回自動で組み直す」で手動調整が消える。
        renderClassStudents();
    }

    function findAssignmentBySlotId(slotId) {
        return [...state.assignments.values()].find(item => item.slot.id === slotId);
    }

    function addUndecided(student, reason = '') {
        if (!student || state.undecided.some(item => item.student.key === student.key)) return;
        state.undecided.push({ student, reason: reason || '手動調整で未決定になりました' });
        state.undecided.sort((a, b) => Number(a.student.number) - Number(b.student.number));
    }

    function removeUndecided(key) {
        state.undecided = state.undecided.filter(item => item.student.key !== key);
    }

    function createUndecidedEntry(student, response, occupied, fallbackReason = '') {
        return {
            student,
            reason: fallbackReason || getUndecidedReason(response, occupied, student)
        };
    }

    function getUndecidedReason(response, occupied, student) {
        if (!response) {
            if (student && state.conflictKeys.has(student.key)) {
                return '照合できなかった回答があります。「名簿と回答を照合する」で確認してください';
            }
            return '保護者回答がありません';
        }
        const preferenceSlots = state.slots.filter(slot => isSlotAvailable(response, slot));
        if (preferenceSlots.length === 0) return '保護者の希望条件に合うコマがありません';
        const usableBeforeAssigned = preferenceSlots.filter(slot => !state.blockedSlots.has(slot.id));
        if (usableBeforeAssigned.length === 0) return '希望条件に合うコマがすべて、担任が空けたいコマに含まれています';
        const remaining = usableBeforeAssigned.filter(slot => !occupied.has(slot.id));
        if (remaining.length === 0) return '希望条件に合うコマが、すでに他の生徒で埋まっています';
        return '自動割当で選べるコマが見つかりませんでした';
    }

    function formatUndecidedListItem(entry) {
        const student = entry.student || entry;
        const reason = entry.reason || '理由を判定できませんでした';
        return `<li><span>${escapeHtml(student.number)}番 ${escapeHtml(student.name)}</span><small>${escapeHtml(reason)}</small></li>`;
    }

    function assignmentWarningLabel(assignment) {
        if (state.blockedSlots.has(assignment.slot.id)) return '空け指定のコマ';
        const response = state.students.get(assignment.student.key);
        if (!response) return '回答なし';
        return isSlotAvailable(response, assignment.slot) ? '' : '希望外';
    }

    function showManualPreferenceWarning(student, slot) {
        const response = state.students.get(student.key);
        if (!elements.manualEditWarning) return;
        if (state.blockedSlots.has(slot.id)) {
            elements.manualEditWarning.hidden = false;
            elements.manualEditWarning.textContent = `${slot.dateLabel} ${slot.display}は「担任が空けたいコマ」に指定されています。${student.number}番 ${student.name}さんを入れる場合は、空け指定を見直してください。`;
            return;
        }
        if (!response) {
            elements.manualEditWarning.hidden = false;
            elements.manualEditWarning.textContent = `${student.number}番 ${student.name}さんは回答がありません。保護者に確認したうえで確定してください。`;
            return;
        }
        if (!isSlotAvailable(response, slot)) {
            elements.manualEditWarning.hidden = false;
            elements.manualEditWarning.textContent = `${student.number}番 ${student.name}さんは、${slot.dateLabel} ${slot.display}を希望していません。必要なら保護者に確認してください。`;
            return;
        }
        clearManualEditWarning();
    }

    function clearManualEditWarning() {
        if (!elements.manualEditWarning) return;
        elements.manualEditWarning.hidden = true;
        elements.manualEditWarning.textContent = '';
    }

    function renderPrintViews(undecided = state.undecided) {
        const assignments = [...state.assignments.values()].sort(compareAssignment);
        renderTeacherList(assignments, undecided);
        renderNotices(assignments);
        window.requestAnimationFrame(checkPrintFit);
    }

    function renderTeacherList(assignments, undecided) {
        const undecidedRows = undecided.map(formatUndecidedListItem).join('');
        const remarkRows = collectClassRemarks().join('');
        elements.teacherPreview.innerHTML = `
            <article class="a4-page schedule-matrix-page">
                <h2>${escapeHtml(state.selectedClass || '')} 三者懇談 日程一覧</h2>
                ${buildScheduleMatrix(assignments, 'teacher')}
                ${remarkRows ? `<h3>保護者からの連絡（備考欄より）</h3><ul>${remarkRows}</ul>` : ''}
                ${undecidedRows ? `<h3>未決定</h3><ul>${undecidedRows}</ul>` : ''}
            </article>`;
    }

    function collectClassRemarks() {
        // 兄弟世帯の備考は同じ内容が各生徒のレコードへ入るため、担任一覧では生徒ごとにそのまま並べる。
        return getAssignableStudents()
            .map(student => ({ student, response: state.students.get(student.key) }))
            .filter(item => item.response && item.response.remark)
            .map(item => `<li><span>${escapeHtml(item.student.number)}番 ${escapeHtml(item.student.name)}</span><small>${escapeHtml(item.response.remark)}</small></li>`);
    }

    function buildScheduleMatrix(assignments, mode) {
        const dates = [];
        const times = [];
        state.slots.forEach(slot => {
            if (!dates.includes(slot.dateLabel)) dates.push(slot.dateLabel);
            if (!times.includes(slot.display)) times.push(slot.display);
        });

        const assignmentBySlot = new Map(assignments.map(item => [
            `${item.slot.dateLabel}|${item.slot.display}`,
            item
        ]));
        const header = dates.map(date => `<th scope="col">${escapeHtml(shortDateLabel(date))}</th>`).join('');
        const rows = times.map(time => {
            const cells = dates.map(date => {
                const item = assignmentBySlot.get(`${date}|${time}`);
                if (!item) return '<td class="is-empty"><span aria-label="空き">－</span></td>';
                const type = mode === 'teacher' && item.fixed ? '<small>固定</small>' : '';
                const siblings = siblingSummaryForStudent(item.student);
                return `<td>
                    <span class="schedule-student-line"><strong>${escapeHtml(item.student.number)}番</strong> ${escapeHtml(item.student.name)}</span>
                    ${siblings ? `<small class="schedule-sibling-line">${escapeHtml(siblings)}</small>` : ''}
                    ${type}
                </td>`;
            }).join('');
            return `<tr><th scope="row">${escapeHtml(time)}</th>${cells}</tr>`;
        }).join('');

        return `<div class="schedule-matrix-wrap">
            <table class="print-table schedule-matrix">
                <thead><tr><th scope="col">時刻</th>${header}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    // 印刷物に出す日付。日程条件シートの dateLabel は西暦のままなので、date から組み直す。
    function printDateLabel(slot) {
        return window.ConferenceDocFormat.eraDate(slot.date, true) || slot.dateLabel;
    }

    function renderNotices(assignments) {
        const noticeAssignments = assignments.slice().sort(compareAssignmentByStudentNumber);
        updateNoticePreviewControls(noticeAssignments.length);
        const visibleAssignments = state.showAllNotices ? noticeAssignments : noticeAssignments.slice(0, 1);
        const noticeTitle = (elements.printTitle?.value || '').trim() || DEFAULT_NOTICE_TITLE;
        elements.noticePreview.innerHTML = visibleAssignments.map(item => {
            const studentLabel = `${item.student.className} ${item.student.number}番 ${item.student.name}`;
            return `
                <article class="a4-page notice-page">
                    <div class="doc-head">
                        <div class="doc-date">${escapeHtml(window.ConferenceDocFormat.eraDate(elements.printDocDate.value))}</div>
                        <p class="doc-recipient">${escapeHtml(studentLabel)} さん<br>保護者　様</p>
                        <div class="doc-sender">
                            <p>${escapeHtml(elements.printSchoolName.value)}</p>
                            <p>校長　${escapeHtml(elements.printPrincipalName.value)}</p>
                        </div>
                    </div>
                    <h2>${escapeHtml(noticeTitle)}</h2>
                    <div class="doc-body notice-lead">${paragraphsToHtml(elements.printMessage.value)}</div>
                    <div class="notice-schedule-card">
                        <p class="notice-schedule-caption">お子さまの懇談日時</p>
                        <p class="notice-schedule-date">${escapeHtml(printDateLabel(item.slot))}</p>
                        <p class="notice-schedule-time">${escapeHtml(item.slot.display)}</p>
                        <p class="notice-schedule-meta">
                            <span><small>生徒</small>${escapeHtml(studentLabel)} さん</span>
                            <span><small>場所</small>${escapeHtml(elements.printPlace.value)}</span>
                        </p>
                    </div>
                    <div class="notice-note-block">
                        <h3>お願い・連絡事項</h3>
                        <div class="doc-body">${paragraphsToHtml(elements.printNote.value)}</div>
                    </div>
                    <p class="notice-closing">以　上</p>
                </article>
            `;
        }).join('');
    }

    function updateNoticePreviewControls(total) {
        if (!elements.noticePreviewControls || !elements.toggleNoticePreviewBtn || !elements.noticePreviewStatus) return;
        elements.noticePreviewControls.hidden = total <= 1;
        if (total <= 1) {
            elements.noticePreviewStatus.textContent = '';
            return;
        }
        elements.toggleNoticePreviewBtn.textContent = state.showAllNotices ? '1枚目だけ表示に戻す' : '全員分の案内文を表示';
        elements.noticePreviewStatus.textContent = state.showAllNotices
            ? `全${total}枚を表示中です。`
            : `現在は1枚目だけ表示しています。「保護者通知を印刷」では全${total}枚を出力します。`;
    }

    function checkPrintFit() {
        if (!elements.printFitWarning) return;
        const a4HeightPx = 297 * 96 / 25.4;
        const overflowingPages = [...document.querySelectorAll('.a4-page')]
            .filter(page => page.scrollHeight > a4HeightPx + 4);
        const message = [];
        if (overflowingPages.some(page => page.classList.contains('schedule-matrix-page'))) {
            message.push('一覧表がA4 1枚に収まりきらない可能性があります。日程枠や未決定者が多い場合は確認してください。');
        }
        if (overflowingPages.some(page => page.classList.contains('notice-page'))) {
            message.push('保護者通知がA4 1枚に収まりきらない可能性があります。通知本文やお願い・連絡事項を短くしてください。');
        }
        elements.printFitWarning.hidden = message.length === 0;
        elements.printFitWarning.textContent = message.join(' ');
    }

    function siblingSummaryForStudent(student) {
        const response = state.students.get(student.key);
        if (!response) return '';
        return response.householdStudents
            .map(item => reconcileResponseIdentity(item, state.roster))
            .filter(item => item.key !== student.key)
            .map(item => {
                const displayStudent = item.matchedRoster || item;
                return `${displayStudent.className} ${displayStudent.name}`;
            })
            .join(' / ');
    }

    // 選んだ学級の名簿全員。生徒表の描画にだけ使う（対象外の生徒もチェックを外した状態で表示するため）。
    function getSelectedRosterStudents() {
        return state.roster
            .filter(student => student.className === state.selectedClass)
            .map(student => ({ ...student, key: makeKey(student.className, student.number) }))
            .sort((a, b) => Number(a.number) - Number(b.number));
    }

    // 実際に懇談を組む生徒。対象外にした生徒は割当・集計・印刷物のすべてから外れる。
    function getAssignableStudents() {
        return getSelectedRosterStudents().filter(student => !state.excludedStudents.has(student.key));
    }

    function compareAssignment(a, b) {
        return a.slot.sort - b.slot.sort || Number(a.student.number) - Number(b.student.number);
    }

    function compareAssignmentByStudentNumber(a, b) {
        return Number(a.student.number) - Number(b.student.number)
            || a.student.name.localeCompare(b.student.name, 'ja')
            || a.slot.sort - b.slot.sort;
    }

    function responseModeLabel() {
        return state.meta.responseMode === 'checked_available' ? '参加できる日時を選ぶ' : '参加できない日時を選ぶ';
    }

    function parseTimestamp(value) {
        if (value instanceof Date) return value.getTime();
        const parsed = Date.parse(String(value || ''));
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    function makeKey(className, number) {
        return `${normalizeText(className)}|${normalizeNumber(number)}`;
    }

    function normalizeText(value) {
        return String(value || '').trim().replace(/\s+/g, '');
    }

    function normalizeName(value) {
        return normalizeText(value).replace(/[　\s]/g, '');
    }

    function normalizeNumber(value) {
        const normalized = String(value || '').trim().replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
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

    function updateTutorialStep(activeStep) {
        document.querySelectorAll('[data-tutorial-step]').forEach(item => {
            item.classList.toggle('is-active', item.dataset.tutorialStep === activeStep);
            item.classList.toggle('is-done', tutorialStepOrder(item.dataset.tutorialStep) < tutorialStepOrder(activeStep));
        });
    }

    function tutorialStepOrder(step) {
        // サンプル体験ページは読み込みステップを "sample" と呼ぶため、同じ段として扱う。
        const normalized = step === 'sample' ? 'load' : step;
        return ['load', 'check', 'assign', 'result', 'print'].indexOf(normalized);
    }

    function formatJapaneseDate(dateString) {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return `${year}年${month}月${day}日（${WEEKDAYS[date.getDay()]}）`;
    }

    function formatJapaneseDateWithoutWeekday(dateString) {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-').map(Number);
        return `${year}年${month}月${day}日`;
    }

    function paragraphsToHtml(value) {
        return String(value || '')
            .split(/\n+/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => `<p>${escapeHtml(line)}</p>`)
            .join('');
    }

    function showError(message) {
        elements.schedulerError.hidden = false;
        elements.schedulerError.textContent = message;
    }

    function clearError() {
        elements.schedulerError.hidden = true;
        elements.schedulerError.textContent = '';
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function validateDocDateForPdf() {
        if (!elements.printDocDate || elements.printDocDate.value) return true;
        const warning = document.getElementById('printDocDateWarning');
        if (warning) {
            warning.hidden = false;
            warning.textContent = '文書日付を入力してからPDFをダウンロードしてください。';
            elements.printDocDate.focus();
        } else {
            elements.printDocDate.focus();
            elements.printDocDate.reportValidity();
        }
        return false;
    }

    let pdfInFlight = false;

    async function downloadPdf(mode) {
        if (pdfInFlight) return;
        if (!window.jspdf || !window.html2canvas) {
            showError('PDFライブラリが読み込まれていません。ページを再読み込みしてください。');
            return;
        }

        pdfInFlight = true;
        const allPdfButtons = [...document.querySelectorAll('[data-print-mode]')];
        const btn = document.querySelector(`[data-print-mode="${escapeHtml(mode)}"]`);
        const originalText = btn ? btn.innerHTML : '';
        allPdfButtons.forEach(button => {
            button.disabled = true;
        });
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PDF生成中...';

        try {
            const { jsPDF } = window.jspdf;
            const pages = collectPdfPages(mode);
            if (pages.length === 0) {
                showError('印刷するページがありません。先に日程を組んでください。');
                return;
            }

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            for (let i = 0; i < pages.length; i++) {
                if (btn && pages.length > 1) {
                    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> PDF生成中... ${i + 1}/${pages.length}枚`;
                }
                // 描画ループ中もボタンの進捗表示を更新できるよう、1枚ごとにUIへ制御を返す。
                await new Promise(resolve => window.setTimeout(resolve, 0));

                const page = pages[i];
                const clone = clonePageForCapture(page);
                document.body.appendChild(clone);

                let canvas;
                try {
                    const cloneH = clone.offsetHeight;
                    canvas = await window.html2canvas(clone, {
                        scale: 2,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#ffffff',
                        logging: false,
                        width: 794,
                        height: cloneH,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: 794,
                        windowHeight: cloneH
                    });
                } finally {
                    clone.remove();
                }

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdfW = 210;
                const pdfH = (canvas.height * pdfW) / canvas.width;

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
            }

            const filename = buildPdfFilename(mode);
            pdf.save(filename);
        } catch (error) {
            showError(`PDF生成に失敗しました。${error.message}`);
        } finally {
            pdfInFlight = false;
            allPdfButtons.forEach(button => {
                button.disabled = false;
            });
            if (btn) btn.innerHTML = originalText;
        }
    }

    function collectPdfPages(mode) {
        if (mode === 'notice') {
            return [...document.querySelectorAll('.print-notices .a4-page')];
        }
        if (mode === 'teacher') {
            return [...document.querySelectorAll('.print-teacher .a4-page')];
        }
        return [];
    }

    function clonePageForCapture(page) {
        const wrapper = document.createElement('div');
        wrapper.setAttribute('aria-hidden', 'true');
        wrapper.style.cssText = [
            'position:absolute',
            'top:0',
            'left:-10000px',
            'width:794px',   // A4 @ 96dpi ≒ 794px
            'background:#fff',
            'pointer-events:none',
            'overflow:hidden'
        ].join(';');
        const cloned = page.cloneNode(true);
        // 画面外でA4幅に固定し、余白や文字サイズは通常のCSSを使って描画する。
        cloned.style.cssText = [
            'width:210mm',
            'max-width:none',
            'margin:0',
            'box-shadow:none'
        ].join(';');
        wrapper.appendChild(cloned);
        return wrapper;
    }

    function buildPdfFilename(mode) {
        const className = (state.selectedClass || 'クラス').replace(/\s/g, '');
        const dateStr = (elements.printDocDate && elements.printDocDate.value)
            ? elements.printDocDate.value.replace(/-/g, '')
            : formatDateForFilename(new Date());
        if (mode === 'notice') return `三者懇談通知_${className}_${dateStr}.pdf`;
        if (mode === 'teacher') return `三者懇談一覧_${className}_${dateStr}.pdf`;
        return `三者懇談_${dateStr}.pdf`;
    }

    function formatDateForFilename(date) {
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    }

    window.ConferenceScheduler = {
        parseRoster,
        parseConditionRows,
        splitCheckboxValue,
        reconcileResponseIdentity
    };
})();
