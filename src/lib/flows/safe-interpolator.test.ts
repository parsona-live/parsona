import { describe, expect, it } from 'vitest';
import { safeInterpolate } from './safe-interpolator';

describe('safeInterpolate', () => {
  it('interpolates direct variables and vars. prefixed variables', () => {
    const vars = { name: 'Alice', 'vars.service': 'Solar Consultation' };
    expect(safeInterpolate('Hello {{ name }}', vars)).toBe('Hello Alice');
    expect(safeInterpolate('Booking for {{ vars.service }}', vars)).toBe('Booking for Solar Consultation');
    expect(safeInterpolate('Booking for {{ service }}', vars)).toBe('Booking for Solar Consultation');
  });

  it('interpolates nested contact, conversation, and message objects', () => {
    const vars = {
      contact: { name: 'Rahul Sharma', phone: '+919876543210' },
      conversation: { id: 'conv-123', channel: 'whatsapp' },
      message: { text: 'How much?' },
    };
    expect(safeInterpolate('Hi {{ contact.name }}, your phone is {{ contact.phone }}', vars)).toBe(
      'Hi Rahul Sharma, your phone is +919876543210',
    );
    expect(safeInterpolate('Channel: {{ conversation.channel }}, query: {{ message.text }}', vars)).toBe(
      'Channel: whatsapp, query: How much?',
    );
  });

  it('supports default filter when value is missing or empty', () => {
    const vars = { contact: { name: '' } };
    expect(safeInterpolate('Hello {{ contact.name | default:"there" }}', vars)).toBe('Hello there');
    expect(safeInterpolate('Your fee is {{ vars.fee | default:"free" }}', vars)).toBe('Your fee is free');
    expect(safeInterpolate('Hello {{ user.first | default:\'friend\' }}', vars)).toBe('Hello friend');
  });

  it('supports pipeline filters: trim, uppercase, lowercase', () => {
    const vars = { service: '  solar panels  ' };
    expect(safeInterpolate('{{ service | trim | uppercase }}', vars)).toBe('SOLAR PANELS');
    expect(safeInterpolate('{{ service | trim | lowercase }}', vars)).toBe('solar panels');
  });

  it('blocks prototype pollution and sensitive properties', () => {
    const vars = { name: 'Normal' };
    expect(safeInterpolate('{{ __proto__ }}', vars)).toBe('');
    expect(safeInterpolate('{{ constructor }}', vars)).toBe('');
    expect(safeInterpolate('{{ contact.__proto__.admin }}', vars)).toBe('');
    expect(safeInterpolate('{{ toString }}', vars)).toBe('');
  });

  it('handles unknown variables safely without throwing', () => {
    expect(safeInterpolate('Value: {{ unknown.nested.path }}', {})).toBe('Value: ');
  });

  it('handles null/undefined gracefully', () => {
    expect(safeInterpolate('', {})).toBe('');
    expect(safeInterpolate('Test {{ nullVar }}', { nullVar: null })).toBe('Test ');
  });
});
