/*
 * "Duel the Regent": chess against an original armoured villain, played with the remote.
 *
 *   Arrows move the cursor, OK picks up a piece and puts it down on a highlighted square.
 *   Right from the last file reaches the side panel (New game, Level). Back drops a held piece,
 *   or returns Home (the game is kept and resumes next time).
 *
 * Pieces keep the classic moves under the names asked for: Leader (king), Champion (queen),
 * Tower (rook), Seer (bishop), Rider (knight), Soldier (pawn). Art is original vector tokens.
 * Engine: js/chess-engine.js. The board is 64 fixed cells; a move only changes classes and the
 * contents of the cells involved, nothing animates in layout.
 */
(function () {
    'use strict';

    var KEY = UI.KEY;
    var $ = UI.$;
    var el = UI.el;
    var E = window.ChessEngine;
    var STORE = 'arn0.chess.v1';

    var NAMES = { k: 'Leader', q: 'Champion', r: 'Tower', b: 'Seer', n: 'Rider', p: 'Soldier' };

    // 48x48 tokens, filled with currentColor and outlined by CSS.
    var ART = {
        p: '<circle cx="24" cy="14" r="7"/><path d="M17 38l2.5-13q4.5-4 9 0L31 38z"/><rect x="12" y="38" width="24" height="5" rx="2"/>',
        r: '<path d="M13 9h5v4h3.5V9h5v4H30V9h5v9l-3.5 3.5V36H35v7H13v-7h3.5V21.5L13 18z"/>',
        n: '<path d="M14 43h21v-6c-1.5-6-4-9.5-4-15 2.5-1 4.5-3.5 4.5-6.5 0-5-4.5-9.5-11-9.5L22 3l-2.5 4.5C15 10 12 15 11 20l4.5 3.5 4.5-3c1 3.5-1.5 7-4.5 11C14 34.5 14 38.5 14 43z"/><circle cx="25" cy="13" r="1.8" class="eye"/>',
        b: '<circle cx="24" cy="7" r="3.2"/><path d="M24 10.5c-7 5.5-10 11-10 16 0 4.5 3.5 7.5 10 7.5s10-3 10-7.5c0-5-3-10.5-10-16z"/><path d="M16 37h16l1.5 1.5v4.5h-19v-4.5z"/><path d="M27 17l-6 7" class="cut"/>',
        q: '<path d="M10 15l6 20h16l6-20-8 7.5L24 9l-6 13.5z"/><circle cx="10" cy="13" r="3"/><circle cx="24" cy="7" r="3"/><circle cx="38" cy="13" r="3"/><path d="M14 37h20l1 6H13z"/>',
        k: '<path d="M22 3h4v5h5v4h-5v5h-4v-5h-5V8h5z"/><path d="M12 33c-2.5-8.5 2-15.5 12-17.5 10 2 14.5 9 12 17.5z"/><path d="M13 36h22l1 7H12z"/>'
    };

    // Original villain portrait: a faceted obsidian helm with a glowing visor.
    var HELM = '<svg viewBox="0 0 120 140"><defs></defs>' +
        '<path d="M60 6 L98 26 L108 70 L92 118 L60 134 L28 118 L12 70 L22 26 Z" fill="#14171e" stroke="#3a3f4a" stroke-width="3"/>' +
        '<path d="M60 6 L60 134" stroke="#2a2e37" stroke-width="2"/>' +
        '<path d="M22 26 L60 44 L98 26" fill="none" stroke="#2a2e37" stroke-width="2"/>' +
        '<path d="M26 64 L56 72 L60 66 L64 72 L94 64 L90 76 L64 82 L60 78 L56 82 L30 76 Z" fill="#ff4b2b" class="visor"/>' +
        '<path d="M40 100 L60 110 L80 100" fill="none" stroke="#3a3f4a" stroke-width="3"/>' +
        '<path d="M36 18 L60 2 L84 18" fill="none" stroke="#ffd34d" stroke-width="3"/>' +
        '</svg>';

    var LEVELS = [
        { key: 'squire', label: 'Squire', depth: 1, ms: 400, jitter: 60 },
        { key: 'knight', label: 'Knight', depth: 2, ms: 900, jitter: 25 },
        { key: 'regent', label: 'Regent', depth: 4, ms: 2500, jitter: 0 }
    ];

    // Original lines.
    var LINES = {
        start: ['Your city sleeps. Your Leader will too.', 'Kneel now and spare us both the bother.', 'Obsidian does not crack.'],
        think: ['The Regent considers…', 'Patience. Empires are not rushed.', 'Calculating your ruin…'],
        takes: ['Another piece for my collection.', 'Did you need that? You did not.', 'Fall in line.'],
        lost: ['A trifle. I have soldiers to spare.', 'You will pay for that one.', 'Enjoy it. It will not last.'],
        check: ['Check. Kneel while you still can.', 'Your Leader trembles.'],
        checked: ['A scratch on obsidian.', 'Bold. Foolish, but bold.'],
        win: ['The Regent stands. The city is mine.'],
        loss: ['Impossible… the armour cracks.'],
        move: ['Your move, little one.', 'Go on. I am listening.', 'Every step brings you closer.'],
        draw: ['A stalemate. We will meet again.']
    };

    function line(kind) {
        var l = LINES[kind];
        return l[Math.floor(Math.random() * l.length)];
    }

    var g = null;            // { s, history, level, last, taken: {w:[],b:[]}, over }
    var cur = { r: 6, c: 4, panel: -1 };
    var held = -1;           // square of the picked-up piece
    var targets = [];        // legal moves of the held piece
    var thinking = false;
    var cells = [];

    function newGame(levelKey) {
        g = { s: E.initial(), level: levelKey || (g && g.level) || 'knight', last: null, taken: { w: [], b: [] }, over: null };
        held = -1;
        targets = [];
        cur = { r: 6, c: 4, panel: -1 };
        say(line('start'));
        save();
    }

    function save() {
        try { localStorage.setItem(STORE, JSON.stringify(g)); } catch (e) { /* no resume, that is all */ }
    }

    function load() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORE));
            if (saved && saved.s && saved.s.board && saved.s.board.length === 64) g = saved;
        } catch (e) {
            g = null;
        }
    }

    function level() {
        return LEVELS.find(function (l) { return l.key === g.level; }) || LEVELS[1];
    }

    // ---------- Rendering

    function pieceSvg(p) {
        var t = p.toLowerCase();
        return '<svg class="pc ' + (p === t ? 'pc-v' : 'pc-p') + '" viewBox="0 0 48 48">' + ART[t] + '</svg>';
    }

    // On the board: carved sprites standing on a tilted board in Noir (img/chess, make-chess.mjs),
    // the flat vector tokens elsewhere. Captured pieces always use the tokens.
    function cellHtml(p) {
        if (!p) return '';
        if (!document.documentElement.classList.contains('theme-noir')) return pieceSvg(p);
        var t = p.toLowerCase();
        return '<img class="pc3" src="img/chess/' + (p === t ? 'b' : 'w') + t + '.png" alt="">';
    }

    function build() {
        var board = $('chess-board');
        board.innerHTML = '';
        cells = [];
        for (var i = 0; i < 64; i++) {
            var cell = el('div', 'sq ' + (((i >> 3) + (i & 7)) % 2 ? 'dark' : 'light'));
            board.appendChild(cell);
            cells.push(cell);
        }
        $('chess-helm').innerHTML = HELM;
        // Noir: the Regent looms over the far side of the board.
        if (!$('chess-backdrop')) {
            var back = el('div', 'chess-backdrop');
            back.id = 'chess-backdrop';
            back.innerHTML = HELM;
            board.parentNode.insertBefore(back, board);
        }
    }

    function render() {
        var b = g.s.board;
        var tset = {};
        targets.forEach(function (m) { tset[m.to] = m.captured ? 'cap' : 'dot'; });
        var checkSq = E.inCheck(g.s) ? b.indexOf(g.s.turn === 'w' ? 'K' : 'k') : -1;
        for (var i = 0; i < 64; i++) {
            var cell = cells[i];
            var html = cellHtml(b[i]);
            if (cell._html !== html) { cell.innerHTML = html; cell._html = html; }
            cell.classList.toggle('last', !!g.last && (g.last.from === i || g.last.to === i));
            cell.classList.toggle('held', held === i);
            cell.classList.toggle('dot', tset[i] === 'dot');
            cell.classList.toggle('cap', tset[i] === 'cap');
            cell.classList.toggle('check', checkSq === i);
            cell.classList.toggle('cursor', cur.panel < 0 && i === cur.r * 8 + cur.c);
        }
        var under = b[cur.r * 8 + cur.c];
        $('chess-under').textContent = cur.panel < 0 && under
            ? (E.colorOf(under) === 'w' ? 'Your ' : 'Regent’s ') + NAMES[under.toLowerCase()]
            : '';
        $('chess-level').textContent = 'Level: ' + level().label;
        ['chess-new', 'chess-level'].forEach(function (id, n) {
            $(id).classList.toggle('focused', cur.panel === n);
        });
        $('chess-taken-v').innerHTML = g.taken.w.map(pieceSvg).join('');
        $('chess-taken-p').innerHTML = g.taken.b.map(pieceSvg).join('');
        $('chess-status').textContent = statusText();
        UI.refreshHints();
    }

    function statusText() {
        if (g.over === 'win') return 'Checkmate. You win.';
        if (g.over === 'loss') return 'Checkmate. The Regent wins.';
        if (g.over) return 'Draw.';
        if (thinking) return 'The Regent is thinking…';
        return E.inCheck(g.s) ? 'Your move. You are in check.' : 'Your move.';
    }

    function say(text) {
        var t = $('chess-taunt');
        if (t) t.textContent = '“' + text + '”';
    }

    // ---------- Play

    function finishIfOver() {
        var st = E.status(g.s);
        if (st === 'play') return false;
        if (st === 'checkmate') {
            g.over = g.s.turn === 'w' ? 'loss' : 'win';
            say(line(g.over === 'win' ? 'loss' : 'win'));
            if (window.Sound) Sound.play('select');
        } else {
            g.over = 'draw';
            say(line('draw'));
        }
        save();
        return true;
    }

    function playMove(m) {
        if (m.captured) g.taken[E.colorOf(m.piece)].push(m.captured);
        g.s = E.apply(g.s, m);
        g.last = { from: m.from, to: m.to };
        save();
    }

    function playerMove(m) {
        playMove(m);
        held = -1;
        targets = [];
        if (finishIfOver()) { render(); return; }
        say(E.inCheck(g.s) ? line('checked') : m.captured ? line('lost') : line('think'));
        thinking = true;
        render();
        // Let the screen paint before the search blocks the main thread.
        setTimeout(villainMove, 350);
    }

    function villainMove() {
        var lv = level();
        var m = E.bestMove(g.s, { depth: lv.depth, ms: lv.ms, jitter: lv.jitter });
        thinking = false;
        if (!m) { finishIfOver(); render(); return; }
        playMove(m);
        DevLog.log('Chess: Regent ' + m.from + '-' + m.to + ' depth ' + m.depth + ' nodes ' + m.nodes);
        if (!finishIfOver()) say(E.inCheck(g.s) ? line('check') : m.captured ? line('takes') : line('move'));
        if (window.Sound) Sound.play('move');
        render();
    }

    function ok() {
        if (cur.panel === 0) { newGame(); render(); return; }
        if (cur.panel === 1) {
            var i = LEVELS.indexOf(level());
            g.level = LEVELS[(i + 1) % LEVELS.length].key;
            save();
            render();
            return;
        }
        if (thinking || g.over || g.s.turn !== 'w') return;
        var sq = cur.r * 8 + cur.c;
        if (held >= 0) {
            var m = targets.find(function (t) { return t.to === sq; });
            if (m) { playerMove(m); return; }
        }
        var p = g.s.board[sq];
        if (p && E.colorOf(p) === 'w') {
            var moves = E.legal(g.s).filter(function (t) { return t.from === sq; });
            held = moves.length ? sq : -1;
            targets = moves;
            if (!moves.length) UI.toast('That ' + NAMES[p.toLowerCase()] + ' cannot move');
        } else {
            held = -1;
            targets = [];
        }
        render();
    }

    function onKey(k) {
        if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) return false;
        if (k === KEY.ENTER) { ok(); return true; }
        if (cur.panel >= 0) {
            if (k === KEY.LEFT) cur.panel = -1;
            else if (k === KEY.UP) cur.panel = 0;
            else if (k === KEY.DOWN) cur.panel = 1;
        } else {
            if (k === KEY.LEFT) cur.c = Math.max(0, cur.c - 1);
            else if (k === KEY.RIGHT) { if (cur.c === 7) cur.panel = 0; else cur.c += 1; }
            else if (k === KEY.UP) cur.r = Math.max(0, cur.r - 1);
            else if (k === KEY.DOWN) cur.r = Math.min(7, cur.r + 1);
            else return true;
        }
        if (window.Sound) Sound.play('move');
        render();
        return true;
    }

    function hints() {
        if (cur.panel >= 0) return [['OK', 'Select'], ['◀', 'Board'], ['Back', 'Home']];
        if (held >= 0) return [['OK', 'Move here'], ['Back', 'Put down']];
        return [['OK', 'Pick up'], ['▶ at edge', 'Menu'], ['Back', 'Home']];
    }

    function init() {
        if (!E) return;
        UI.register('chess', {
            el: $('chess'),
            onShow: function () {
                if (!cells.length) build();
                if (!g) load();
                if (!g) newGame();
                render();
                // Resume a game that was left on the villain's move.
                if (!g.over && g.s.turn === 'b' && !thinking) { thinking = true; render(); setTimeout(villainMove, 350); }
            },
            onKey: onKey,
            onBack: function () {
                if (held >= 0) { held = -1; targets = []; render(); return true; }
                return false;
            },
            hints: hints
        });
    }

    /*
     * Home's chess row: a small tilted board showing the saved game (or the opening position),
     * the Regent's helm with its visor glowing, and where the game stands. OK opens the game.
     * Pieces are the same pre-rendered sprites as the full board; the visor glow is an opacity
     * pulse on its own layer.
     */
    function renderTeaser(row) {
        if (!E) return 0;
        if (!g) load();
        var s = g ? g.s : E.initial();
        var html = '';
        for (var i = 0; i < 64; i++) {
            var p = s.board[i];
            var at = 'left:' + (20 + (i & 7) * 50) + 'px;top:' + (20 + (i >> 3) * 50) + 'px';
            var last = g && g.last && (g.last.from === i || g.last.to === i) ? ' ct-last' : '';
            html += '<div class="ct-sq' + last + '" style="' + at + '">' +
                (p ? '<img class="ct-pc" src="img/chess/' + (p === p.toLowerCase() ? 'b' : 'w') + p.toLowerCase() + '.png" alt="">' : '') +
                '</div>';
        }
        var playing = g && !g.over && g.last;
        var status = !g || !g.last ? 'He has been waiting.'
            : g.over === 'win' ? 'You beat him last time.'
            : g.over === 'loss' ? 'He won last time.'
            : g.over ? 'Last game was a draw.'
            : 'Your game is waiting.';
        row.innerHTML = '';
        var wrap = el('div', 'chess-teaser');
        wrap.innerHTML =
            '<div class="ct-card">' +
                '<div class="ct-stage"><div class="ct-board">' + html + '</div></div>' +
                '<div class="ct-helm">' + HELM + '<span class="ct-visor-glow"></span></div>' +
                '<div class="ct-text">' +
                    '<div class="ct-kicker">Chess · Level ' + (LEVELS.find(function (l) { return l.key === (g ? g.level : 'knight'); }) || LEVELS[1]).label + '</div>' +
                    '<div class="ct-name">The Obsidian Regent</div>' +
                    '<div class="ct-status">' + status + '</div>' +
                    '<div class="ct-taunt">“' + line(playing ? 'move' : 'start') + '”</div>' +
                    '<div class="ct-cta"><span class="ct-key">OK</span>' + (playing ? 'Resume the duel' : g && g.over ? 'Rematch' : 'Duel the Regent') + '</div>' +
                '</div>' +
            '</div>';
        wrap._item = { kind: 'chess' };
        row.appendChild(wrap);
        return 1;
    }

    window.Chess = { init: init, renderTeaser: renderTeaser };
})();
