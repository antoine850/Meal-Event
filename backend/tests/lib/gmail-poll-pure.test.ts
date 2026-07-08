import { describe, it, expect } from 'vitest'
import {
  collectAddedStubs,
  classifyDirection,
  getHeader,
  parseAddress,
  parseAddressList,
  extractBodies,
} from '../../src/lib/gmail-poll.js'

const b64url = (s: string) => Buffer.from(s, 'utf-8').toString('base64url')

describe('collectAddedStubs', () => {
  it('extrait les messagesAdded, dedupe entre pages, exclut SPAM/TRASH/DRAFT', () => {
    const pages = [
      {
        history: [
          {
            messagesAdded: [
              { message: { id: 'm1', threadId: 't1', labelIds: ['INBOX'] } },
              { message: { id: 'm2', threadId: 't1', labelIds: ['SPAM'] } },
            ],
          },
        ],
      },
      {
        history: [
          {
            messagesAdded: [
              { message: { id: 'm1', threadId: 't1', labelIds: ['INBOX'] } },
              { message: { id: 'm3', threadId: 't2', labelIds: ['TRASH'] } },
              { message: { id: 'm5', threadId: 't1', labelIds: ['DRAFT'] } },
              { message: { id: 'm4', threadId: 't2' } },
            ],
          },
        ],
      },
      {},
    ]
    expect(collectAddedStubs(pages).map((s) => s.id)).toEqual(['m1', 'm4'])
  })

  it('ignore les stubs sans id ou threadId', () => {
    const pages = [{ history: [{ messagesAdded: [{ message: { id: 'x' } }, {}] }] }]
    expect(collectAddedStubs(pages)).toEqual([])
  })
})

describe('classifyDirection', () => {
  it('From == boite -> outbound (reponse du commercial hors CRM)', () => {
    expect(classifyDirection('vendeur@resto.fr', 'Vendeur@Resto.FR')).toBe('outbound')
  })

  it('sinon inbound, y compris From ou boite inconnus', () => {
    expect(classifyDirection('client@gmail.com', 'vendeur@resto.fr')).toBe('inbound')
    expect(classifyDirection(null, 'vendeur@resto.fr')).toBe('inbound')
    expect(classifyDirection('client@gmail.com', null)).toBe('inbound')
  })
})

describe('parsing adresses et headers', () => {
  const headers = [
    { name: 'From', value: 'Jean Dupont <Jean@Client.FR>' },
    { name: 'subject', value: 'Re: Devis' },
  ]

  it('getHeader est insensible a la casse et null si absent', () => {
    expect(getHeader(headers, 'Subject')).toBe('Re: Devis')
    expect(getHeader(headers, 'X-Absent')).toBeNull()
    expect(getHeader(undefined, 'From')).toBeNull()
  })

  it('parseAddress extrait la partie adresse et normalise en minuscules', () => {
    expect(parseAddress('Jean Dupont <Jean@Client.FR>')).toBe('jean@client.fr')
    expect(parseAddress('nu@client.fr')).toBe('nu@client.fr')
    expect(parseAddress(null)).toBeNull()
    expect(parseAddress('')).toBeNull()
  })

  it('parseAddressList gere les listes separees par des virgules', () => {
    expect(parseAddressList('A <a@x.fr>, b@y.fr')).toEqual(['a@x.fr', 'b@y.fr'])
    expect(parseAddressList(null)).toEqual([])
  })

  it('parseAddressList ecarte les fragments de display-name quotes', () => {
    expect(parseAddressList('"Dupont, Jean" <jean@x.fr>')).toEqual(['jean@x.fr'])
  })
})

describe('extractBodies', () => {
  it('trouve text/html et text/plain dans un multipart imbrique', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64url('bonjour') } },
            { mimeType: 'text/html', body: { data: b64url('<p>bonjour</p>') } },
          ],
        },
      ],
    }
    expect(extractBodies(payload)).toEqual({ html: '<p>bonjour</p>', text: 'bonjour' })
  })

  it('message simple non multipart', () => {
    const payload = { mimeType: 'text/plain', body: { data: b64url('salut') } }
    expect(extractBodies(payload)).toEqual({ html: null, text: 'salut' })
  })

  it('payload vide -> les deux null', () => {
    expect(extractBodies(undefined)).toEqual({ html: null, text: null })
  })

  it('respecte le charset declare par la partie (latin1/windows-1252)', () => {
    const payload = {
      mimeType: 'text/plain',
      headers: [
        { name: 'Content-Type', value: 'text/plain; charset=ISO-8859-1' },
      ],
      body: { data: Buffer.from('café prévu', 'latin1').toString('base64url') },
    }
    expect(extractBodies(payload)).toEqual({ html: null, text: 'café prévu' })
  })
})
