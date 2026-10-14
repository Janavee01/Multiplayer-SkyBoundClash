import { test } from 'node:test';
import assert from 'node:assert/strict';
import Character from '../public/character.js';

function makeChar() {
    return new Character('p1', 100, 400, 'darkblue', 0.7, 426);
}

test('attack returns a hitbox and enforces its cooldown', () => {
    const char = makeChar();
    assert.ok(char.attack(0), 'first attack should produce a hitbox');
    assert.equal(char.attack(10), null, 'attack during cooldown should be ignored');
    assert.ok(char.attack(800), 'attack should be ready again after the cooldown');
});

test('kick is blocked while attacking', () => {
    const char = makeChar();
    char.attack(0);
    assert.equal(char.kick(10), null, 'kick should not start mid-attack');
});

test('attack is blocked while kicking', () => {
    const char = makeChar();
    char.kick(0);
    assert.equal(char.attack(10), null, 'attack should not start mid-kick');
});

test('blocking reduces incoming damage', () => {
    const char = makeChar();
    char.block(0);
    char.update(0);
    char.takeDamage(20);
    assert.equal(char.health, 94);
});

test('dodging negates incoming damage', () => {
    const char = makeChar();
    char.dodge(0);
    char.update(0);
    char.takeDamage(20);
    assert.equal(char.health, 100);
});

test('blink toggles visibility then ends', () => {
    const char = makeChar();
    char.blink(0);
    char.updateBlink(150);
    assert.equal(char.invisible, true);
    char.updateBlink(250);
    assert.equal(char.invisible, false);
    char.updateBlink(600);
    assert.equal(char.invisible, false);
    assert.equal(char.isBlinking, false);
});
