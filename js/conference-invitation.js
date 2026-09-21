(function () {
    'use strict';

    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
    const SCHOOL_SETTINGS_KEY = 'conferenceSchoolSettings';

    const elements = {};
    let qrInstance = null;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        setDefaultDate();
        loadSchoolSettings();
        applyAutoGreeting();
        bindEvents();
        updatePreview();
    }

    // 時候の挨拶は conference-doc-format.js（3ページ共通）から取る。
    function buildGreeting(dateString) {
        return `${window.ConferenceDocFormat.opening(dateString)}さて、下記の日程で三者懇談を予定しております。日程調整のため、ご都合の確認をフォームにて行います。お手数ですが、期限までのご入力にご協力ください。`;
    }

    // 「文書日付から自動」のときだけ本文を書き換える。自由入力に切り替えていれば触らない。
    function applyAutoGreeting() {
        if (elements.greetingPreset.value !== 'auto') return;
        elements.greetingText.value = buildGreeting(elements.documentDate.value);
    }

    function cacheElements() {
        [
            'schoolName',
            'documentDate',
            'principalName',
            'targetName',
            'conferencePeriod',
            'deadlineText',
            'formUrl',
            'formUrlWarning',
            'greetingPreset',
            'greetingText',
            'noteText',
            'printInvitationBtn',
            'qrCode'
        ].forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }

    function bindEvents() {
        elements.printInvitationBtn.addEventListener('click', printInvitation);
        elements.greetingPreset.addEventListener('change', () => {
            applyAutoGreeting();
            updatePreview();
        });
        elements.documentDate.addEventListener('change', () => {
            applyAutoGreeting();
            updatePreview();
        });
        // 本文を手で直したら自由入力に切り替える。日付を変えても書き換わらないようにするため。
        elements.greetingText.addEventListener('input', () => {
            if (elements.greetingPreset.value === 'auto') elements.greetingPreset.value = 'custom';
        });
        document.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('input', updatePreview);
        });
    }

    function printInvitation() {
        updatePreview();
        removeUrlWarning();

        if (!elements.formUrl.value.trim()) {
            elements.formUrl.focus();
            const warning = document.createElement('p');
            warning.className = 'field-hint url-warning';
            warning.setAttribute('role', 'alert');
            warning.textContent = '保護者回答用フォームURLを入力してください。';
            elements.formUrl.insertAdjacentElement('afterend', warning);
            window.setTimeout(removeUrlWarning, 6000);
            return;
        }

        const issue = formUrlIssue(elements.formUrl.value);
        if (issue && !window.confirm(`フォームURLをご確認ください。\n\n${issue}\n\nこのまま印刷しますか？`)) {
            elements.formUrl.focus();
            return;
        }

        window.print();
    }

    function formUrlIssue(url) {
        const trimmed = String(url || '').trim();
        if (!trimmed) return '';
        if (/docs\.google\.com\/forms\/d\/e\/[^/]+\/viewform/.test(trimmed)) return '';
        if (/^https?:\/\/forms\.gle\//.test(trimmed)) return '';
        if (/docs\.google\.com\/forms\/.*\/edit/.test(trimmed)) {
            return 'これは先生用の「編集用フォーム」のURLのようです。実行ログの「保護者回答用フォーム」のURL（/viewformで終わる）を貼り付けてください。';
        }
        if (/docs\.google\.com\/spreadsheets/.test(trimmed)) {
            return 'これは回答スプレッドシートのURLのようです。「保護者回答用フォーム」のURL（/viewformで終わる）を貼り付けてください。';
        }
        return 'GoogleフォームのURLではないようです。実行ログの「保護者回答用フォーム」のURL（/viewformで終わる）か確認してください。';
    }

    function updateFormUrlWarning() {
        if (!elements.formUrlWarning) return;
        const issue = formUrlIssue(elements.formUrl.value);
        elements.formUrlWarning.hidden = !issue;
        elements.formUrlWarning.textContent = issue;
    }

    function removeUrlWarning() {
        elements.formUrl
            .closest('.form-group, div')
            ?.querySelector('.url-warning')
            ?.remove();
    }

    function setDefaultDate() {
        const now = new Date();
        elements.documentDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function loadSchoolSettings() {
        try {
            const storedValue = sessionStorage.getItem(SCHOOL_SETTINGS_KEY);
            if (!storedValue) return;

            const settings = JSON.parse(storedValue);
            if (!settings || typeof settings !== 'object') return;

            const documentSettings = settings.documentSettings && typeof settings.documentSettings === 'object'
                ? settings.documentSettings
                : settings;

            if (documentSettings.schoolName) {
                elements.schoolName.value = documentSettings.schoolName;
            }
            if (documentSettings.principalName) {
                elements.principalName.value = documentSettings.principalName;
            }
            const responseDeadline = settings.responseDeadline || documentSettings.responseDeadline;
            if (responseDeadline) {
                elements.deadlineText.value = window.ConferenceDocFormat.eraDate(responseDeadline, true);
            }

            const conferencePeriod = getConferencePeriod(settings);
            if (conferencePeriod.length > 0) {
                elements.conferencePeriod.value = conferencePeriod.join('、');
            }
        } catch (error) {
            // 保存済み設定を読めない場合も、画面上で直接入力して利用できる。
        }
    }

    function getConferencePeriod(settings) {
        if (Array.isArray(settings.conferencePeriod)) {
            return settings.conferencePeriod.filter(Boolean);
        }
        if (typeof settings.conferencePeriod === 'string' && settings.conferencePeriod.trim()) {
            return [settings.conferencePeriod.trim()];
        }
        if (!Array.isArray(settings.schedules)) {
            return [];
        }

        return settings.schedules
            .map(schedule => schedule && schedule.date)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map(date => window.ConferenceDocFormat.eraDate(date, true));
    }

    function updatePreview() {
        setText('schoolName', elements.schoolName.value);
        setText('principalName', elements.principalName.value);
        setText('targetName', elements.targetName.value);
        setHtml('conferencePeriod', conferencePeriodToHtml(elements.conferencePeriod.value));
        setText('deadlineText', elements.deadlineText.value);
        setText('formUrl', elements.formUrl.value || 'フォームURLを入力するとQRコードが表示されます');
        setText('noteText', elements.noteText.value);
        setText('documentDateText', window.ConferenceDocFormat.eraDate(elements.documentDate.value));
        setHtml('greetingHtml', paragraphsToHtml(elements.greetingText.value));
        updateQrCode(elements.formUrl.value.trim());
        updateFormUrlWarning();
    }

    function updateQrCode(url) {
        elements.qrCode.replaceChildren();
        qrInstance = null;

        if (!url) {
            elements.qrCode.textContent = 'QR';
            return;
        }

        if (typeof QRious === 'undefined') {
            elements.qrCode.textContent = 'QRコードを表示できません';
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-label', '保護者回答用フォームのQRコード');
        elements.qrCode.appendChild(canvas);
        qrInstance = new QRious({
            element: canvas,
            value: url,
            size: 150,
            level: 'M'
        });
    }

    function setText(field, value) {
        document.querySelectorAll(`[data-field="${field}"]`).forEach(node => {
            node.textContent = value;
        });
    }

    function setHtml(field, value) {
        document.querySelectorAll(`[data-field="${field}"]`).forEach(node => {
            node.innerHTML = value;
        });
    }

    function conferencePeriodToHtml(value) {
        return String(value)
            .split(/[、,]/)
            .map(item => item.trim())
            .filter(Boolean)
            .map(item => `<span class="doc-date-item">${escapeHtml(item)}</span>`)
            .join('');
    }

    function paragraphsToHtml(value) {
        return value
            .split(/\n+/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => `<p>${escapeHtml(line)}</p>`)
            .join('');
    }

    function formatJapaneseDate(dateString) {
        if (!dateString) return '';

        const matched = String(dateString).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!matched) return String(dateString);

        const year = Number(matched[1]);
        const month = Number(matched[2]);
        const day = Number(matched[3]);
        const date = new Date(year, month - 1, day);
        if (
            date.getFullYear() !== year
            || date.getMonth() !== month - 1
            || date.getDate() !== day
        ) {
            return String(dateString);
        }

        return `${year}年${month}月${day}日（${WEEKDAYS[date.getDay()]}）`;
    }

    function formatJapaneseDateWithoutWeekday(dateString) {
        if (!dateString) return '';

        const matched = String(dateString).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!matched) return String(dateString);

        return `${Number(matched[1])}年${Number(matched[2])}月${Number(matched[3])}日`;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();
