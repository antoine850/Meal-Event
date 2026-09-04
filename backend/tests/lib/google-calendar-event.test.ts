import { describe, it, expect } from 'vitest'
import { buildCalendarEvent, nextDay } from '../../src/lib/google-calendar.js'

describe('nextDay', () => {
  it('incremente d un jour', () => {
    expect(nextDay('2026-06-23')).toBe('2026-06-24')
  })
  it('passe les fins de mois et d annee', () => {
    expect(nextDay('2026-06-30')).toBe('2026-07-01')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
  })
  it('gere les annees bissextiles', () => {
    expect(nextDay('2028-02-28')).toBe('2028-02-29')
  })
})

const base = {
  id: 'b1',
  event_date: '2026-06-23',
  guests_count: 12,
  contact: { first_name: 'Jane', last_name: 'Doe' },
}

describe('buildCalendarEvent', () => {
  it('all-day : fin exclusive au lendemain (exigence API Google)', () => {
    const e = buildCalendarEvent({ ...base, start_time: null })
    expect(e.start).toEqual({ date: '2026-06-23' })
    expect(e.end).toEqual({ date: '2026-06-24' })
  })

  it('horaires : dateTime Europe/Paris, fin par defaut midi -> 15h', () => {
    const e = buildCalendarEvent({ ...base, start_time: '12:00' })
    expect(e.start).toEqual({
      dateTime: '2026-06-23T12:00:00',
      timeZone: 'Europe/Paris',
    })
    expect(e.end).toEqual({
      dateTime: '2026-06-23T15:00:00',
      timeZone: 'Europe/Paris',
    })
  })

  it('horaires : fin par defaut 23h hors midi, fin explicite respectee', () => {
    const soir = buildCalendarEvent({ ...base, start_time: '19:30' })
    expect(soir.end).toEqual({
      dateTime: '2026-06-23T23:00:00',
      timeZone: 'Europe/Paris',
    })
    const explicite = buildCalendarEvent({
      ...base,
      start_time: '19:30',
      end_time: '22:00',
    })
    expect(explicite.end).toEqual({
      dateTime: '2026-06-23T22:00:00',
      timeZone: 'Europe/Paris',
    })
  })

  it('horaires : fin avant le debut = service qui passe minuit, fin au lendemain', () => {
    const minuit = buildCalendarEvent({
      ...base,
      start_time: '20:30',
      end_time: '00:00',
    })
    expect(minuit.end).toEqual({
      dateTime: '2026-06-24T00:00:00',
      timeZone: 'Europe/Paris',
    })
    const deuxHeures = buildCalendarEvent({
      ...base,
      start_time: '19:00',
      end_time: '02:00',
    })
    expect(deuxHeures.end).toEqual({
      dateTime: '2026-06-24T02:00:00',
      timeZone: 'Europe/Paris',
    })
  })

  it('summary : occasion + contact + pax', () => {
    const e = buildCalendarEvent({ ...base, occasion: 'Anniversaire' })
    expect(e.summary).toBe('Anniversaire — Jane Doe (12 pers.)')
  })
})
