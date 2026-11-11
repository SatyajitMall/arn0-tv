/*
 * Small self-contained chess engine for the "Duel the Regent" game (js/chess.js).
 *
 * Board: 64 squares, index = row * 8 + col, row 0 = rank 8 (top, the villain's side).
 * Pieces: 'P N B R Q K' for the player (white), lowercase for the villain (black), '' for empty.
 * Rules: all legal moves including castling, en passant and promotion (to a queen). Draws by
 * stalemate and the 50-move rule. Search: negamax with alpha-beta, captures first, iterative
 * deepening with a time budget so a slow TV never hangs.
 *
 * Works in the browser (window.ChessEngine) and in Node (module.exports) for tests.
 */
(function (root) {
    'use strict';

    var N = -8, S = 8, E = 1, W = -1;
    var KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    var KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    var ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    var VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    var MATE = 100000;

    // Piece-square tables from white's point of view (row 0 = rank 8). Mirrored for black.
    var PST = {
        p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10,
            5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5,
            5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
        n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30,
            -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30,
            -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
        b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
            -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
            -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
        r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
        q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
            -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10,
            -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
        k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
            20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
    };

    function isWhite(p) { return p !== '' && p === p.toUpperCase(); }
    function colorOf(p) { return p === '' ? null : (isWhite(p) ? 'w' : 'b'); }
    function other(c) { return c === 'w' ? 'b' : 'w'; }
    function rc(i) { return [i >> 3, i & 7]; }
    function idx(r, c) { return r * 8 + c; }
    function onBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    function initial() {
        var back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        var board = [];
        for (var i = 0; i < 64; i++) board.push('');
        for (var c = 0; c < 8; c++) {
            board[c] = back[c];
            board[8 + c] = 'p';
            board[48 + c] = 'P';
            board[56 + c] = back[c].toUpperCase();
        }
        return { board: board, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0 };
    }

    function clone(s) {
        return { board: s.board.slice(), turn: s.turn, castle: { K: s.castle.K, Q: s.castle.Q, k: s.castle.k, q: s.castle.q }, ep: s.ep, half: s.half };
    }

    // Is square `sq` attacked by side `by`?
    function attacked(board, sq, by) {
        var p = rc(sq), r = p[0], c = p[1], i, d, rr, cc, q;
        // Pawns: a white pawn attacks upward (row - 1), so it sits at row + 1.
        var pr = by === 'w' ? r + 1 : r - 1;
        var pawn = by === 'w' ? 'P' : 'p';
        if (onBoard(pr, c - 1) && board[idx(pr, c - 1)] === pawn) return true;
        if (onBoard(pr, c + 1) && board[idx(pr, c + 1)] === pawn) return true;
        var knight = by === 'w' ? 'N' : 'n';
        for (i = 0; i < 8; i++) {
            rr = r + KNIGHT[i][0]; cc = c + KNIGHT[i][1];
            if (onBoard(rr, cc) && board[idx(rr, cc)] === knight) return true;
        }
        var king = by === 'w' ? 'K' : 'k';
        for (i = 0; i < 8; i++) {
            rr = r + KING[i][0]; cc = c + KING[i][1];
            if (onBoard(rr, cc) && board[idx(rr, cc)] === king) return true;
        }
        var rook = by === 'w' ? 'R' : 'r', bishop = by === 'w' ? 'B' : 'b', queen = by === 'w' ? 'Q' : 'q';
        for (i = 0; i < 4; i++) {
            d = ROOK_DIRS[i]; rr = r + d[0]; cc = c + d[1];
            while (onBoard(rr, cc)) {
                q = board[idx(rr, cc)];
                if (q !== '') { if (q === rook || q === queen) return true; break; }
                rr += d[0]; cc += d[1];
            }
            d = BISHOP_DIRS[i]; rr = r + d[0]; cc = c + d[1];
            while (onBoard(rr, cc)) {
                q = board[idx(rr, cc)];
                if (q !== '') { if (q === bishop || q === queen) return true; break; }
                rr += d[0]; cc += d[1];
            }
        }
        return false;
    }

    function kingSquare(board, side) {
        var k = side === 'w' ? 'K' : 'k';
        return board.indexOf(k);
    }

    function inCheck(s, side) {
        side = side || s.turn;
        var k = kingSquare(s.board, side);
        return k >= 0 && attacked(s.board, k, other(side));
    }

    function push(list, s, from, to, extra) {
        var m = { from: from, to: to, piece: s.board[from], captured: s.board[to] };
        if (extra) for (var k in extra) m[k] = extra[k];
        list.push(m);
    }

    function pseudo(s) {
        var b = s.board, side = s.turn, list = [];
        for (var i = 0; i < 64; i++) {
            var p = b[i];
            if (p === '' || colorOf(p) !== side) continue;
            var t = p.toLowerCase(), pos = rc(i), r = pos[0], c = pos[1], k, rr, cc, j;
            if (t === 'p') {
                var dir = side === 'w' ? -1 : 1, start = side === 'w' ? 6 : 1, last = side === 'w' ? 0 : 7;
                rr = r + dir;
                if (onBoard(rr, c) && b[idx(rr, c)] === '') {
                    push(list, s, i, idx(rr, c), rr === last ? { promo: side === 'w' ? 'Q' : 'q' } : null);
                    if (r === start && b[idx(r + 2 * dir, c)] === '') push(list, s, i, idx(r + 2 * dir, c), { double: true });
                }
                for (j = -1; j <= 1; j += 2) {
                    cc = c + j;
                    if (!onBoard(rr, cc)) continue;
                    var to = idx(rr, cc);
                    if (b[to] !== '' && colorOf(b[to]) !== side) {
                        push(list, s, i, to, rr === last ? { promo: side === 'w' ? 'Q' : 'q' } : null);
                    } else if (to === s.ep) {
                        push(list, s, i, to, { enPassant: true, captured: side === 'w' ? 'p' : 'P' });
                    }
                }
            } else if (t === 'n' || t === 'k') {
                var steps = t === 'n' ? KNIGHT : KING;
                for (k = 0; k < 8; k++) {
                    rr = r + steps[k][0]; cc = c + steps[k][1];
                    if (!onBoard(rr, cc)) continue;
                    var q = b[idx(rr, cc)];
                    if (q === '' || colorOf(q) !== side) push(list, s, i, idx(rr, cc));
                }
                if (t === 'k') castles(s, i, list);
            } else {
                var dirs = t === 'r' ? ROOK_DIRS : t === 'b' ? BISHOP_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
                for (k = 0; k < dirs.length; k++) {
                    rr = r + dirs[k][0]; cc = c + dirs[k][1];
                    while (onBoard(rr, cc)) {
                        var x = b[idx(rr, cc)];
                        if (x === '') push(list, s, i, idx(rr, cc));
                        else { if (colorOf(x) !== side) push(list, s, i, idx(rr, cc)); break; }
                        rr += dirs[k][0]; cc += dirs[k][1];
                    }
                }
            }
        }
        return list;
    }

    function castles(s, from, list) {
        var side = s.turn, b = s.board, enemy = other(side);
        var home = side === 'w' ? 60 : 4;
        if (from !== home || attacked(b, home, enemy)) return;
        var kingSide = side === 'w' ? s.castle.K : s.castle.k;
        var queenSide = side === 'w' ? s.castle.Q : s.castle.q;
        var rook = side === 'w' ? 'R' : 'r';
        if (kingSide && b[home + 3] === rook && b[home + 1] === '' && b[home + 2] === '' &&
            !attacked(b, home + 1, enemy) && !attacked(b, home + 2, enemy)) {
            push(list, s, home, home + 2, { castle: 'k' });
        }
        if (queenSide && b[home - 4] === rook && b[home - 1] === '' && b[home - 2] === '' && b[home - 3] === '' &&
            !attacked(b, home - 1, enemy) && !attacked(b, home - 2, enemy)) {
            push(list, s, home, home - 2, { castle: 'q' });
        }
    }

    function apply(s, m) {
        var n = clone(s), b = n.board, side = s.turn;
        b[m.to] = m.promo || m.piece;
        b[m.from] = '';
        if (m.enPassant) b[m.to + (side === 'w' ? S : N)] = '';
        if (m.castle === 'k') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
        if (m.castle === 'q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
        n.ep = m.double ? (m.from + m.to) / 2 : -1;
        // Castling rights: any move from or to a king or rook home square removes them.
        [m.from, m.to].forEach(function (sq) {
            if (sq === 60) { n.castle.K = false; n.castle.Q = false; }
            if (sq === 4) { n.castle.k = false; n.castle.q = false; }
            if (sq === 63) n.castle.K = false;
            if (sq === 56) n.castle.Q = false;
            if (sq === 7) n.castle.k = false;
            if (sq === 0) n.castle.q = false;
        });
        n.half = (m.piece.toLowerCase() === 'p' || m.captured) ? 0 : s.half + 1;
        n.turn = other(side);
        return n;
    }

    function legal(s) {
        return pseudo(s).filter(function (m) { return !inCheck(apply(s, m), s.turn); });
    }

    // 'play' | 'checkmate' | 'stalemate' | 'fifty'
    function status(s, moves) {
        moves = moves || legal(s);
        if (!moves.length) return inCheck(s) ? 'checkmate' : 'stalemate';
        if (s.half >= 100) return 'fifty';
        return 'play';
    }

    // Score from white's point of view.
    function evaluate(s) {
        var score = 0, b = s.board;
        for (var i = 0; i < 64; i++) {
            var p = b[i];
            if (p === '') continue;
            var t = p.toLowerCase();
            if (isWhite(p)) score += VALUE[t] + PST[t][i];
            else score -= VALUE[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)];
        }
        return score;
    }

    function order(moves) {
        return moves.sort(function (a, b) {
            var va = a.captured ? VALUE[a.captured.toLowerCase()] * 10 - VALUE[a.piece.toLowerCase()] : 0;
            var vb = b.captured ? VALUE[b.captured.toLowerCase()] * 10 - VALUE[b.piece.toLowerCase()] : 0;
            if (a.promo) va += 8000;
            if (b.promo) vb += 8000;
            return vb - va;
        });
    }

    function Timeout() {}

    function negamax(s, depth, alpha, beta, ply, ctx) {
        if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw new Timeout();
        var moves = legal(s);
        if (!moves.length) return inCheck(s) ? -MATE + ply : 0;
        if (s.half >= 100) return 0;
        if (depth === 0) return (s.turn === 'w' ? 1 : -1) * evaluate(s);
        order(moves);
        var best = -Infinity;
        for (var i = 0; i < moves.length; i++) {
            var v = -negamax(apply(s, moves[i]), depth - 1, -beta, -alpha, ply + 1, ctx);
            if (v > best) best = v;
            if (v > alpha) alpha = v;
            if (alpha >= beta) break;
        }
        return best;
    }

    /*
     * Best move for the side to move. opts.depth: max depth; opts.ms: time budget. Iterative
     * deepening keeps the best move of the last finished depth if time runs out. A little
     * randomness among equal moves keeps the villain from playing the same game every time.
     */
    function bestMove(s, opts) {
        opts = opts || {};
        var maxDepth = opts.depth || 2;
        var ctx = { nodes: 0, deadline: Date.now() + (opts.ms || 1500) };
        var moves = order(legal(s));
        if (!moves.length) return null;
        var best = moves[0], bestDepth = 0;
        for (var d = 1; d <= maxDepth; d++) {
            try {
                var scored = [];
                var alpha = -Infinity;
                for (var i = 0; i < moves.length; i++) {
                    var v = -negamax(apply(s, moves[i]), d - 1, -Infinity, -alpha, 1, ctx);
                    scored.push({ m: moves[i], v: v });
                    if (v > alpha) alpha = v;
                }
                scored.sort(function (a, b) { return b.v - a.v; });
                var top = scored.filter(function (x) { return x.v >= scored[0].v - (opts.jitter || 0); });
                best = top[Math.floor(Math.random() * top.length)].m;
                bestDepth = d;
                // Put the best first so the next depth searches it first.
                moves = [best].concat(moves.filter(function (m) { return m !== best; }));
            } catch (e) {
                if (!(e instanceof Timeout)) throw e;
                break;
            }
        }
        best.depth = bestDepth;
        best.nodes = ctx.nodes;
        return best;
    }

    var api = {
        initial: initial, legal: legal, apply: apply, status: status, inCheck: inCheck,
        evaluate: evaluate, bestMove: bestMove, colorOf: colorOf
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ChessEngine = api;
})(this);
