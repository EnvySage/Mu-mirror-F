export const tarotCategories = [
  { id: 'major', name: '大阿尔卡纳', symbol: '✦', color: '#f0d899' },
  { id: 'wands', name: '权杖', symbol: '♧', color: '#ffb854' },
  { id: 'cups', name: '圣杯', symbol: '∪', color: '#82eee1' },
  { id: 'swords', name: '宝剑', symbol: '†', color: '#c7dcff' },
  { id: 'pentacles', name: '星币', symbol: '✧', color: '#91d7a1' },
]
export const tarotCategory = card => tarotCategories.find(item => item.id === card?.category) || tarotCategories[0]
export const orientationLabel = orientation => orientation === 'reversed' ? '逆位' : '正位'
export function tarotPerspective(card, orientation) {
  if (!card) return null
  if (orientation !== 'reversed') return card
  return { ...card,
    keyword: card.reversed_keyword || card.reversedKeyword || card.keyword,
    meaning: card.reversed_meaning || card.reversedMeaning || card.meaning,
    action: card.reversed_action || card.reversedAction || card.action,
    headline: card.reversed_keyword || card.reversedKeyword || card.keyword,
  }
}
