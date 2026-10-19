import request from './request'

export const getGrowth = () => request.get('/growth')
export const getGrowthAxes = () => request.get('/growth/axes')
export const updateGrowthAxes = body => request.put('/growth/axes', body)
export const getGrowthEntries = () => request.get('/growth/entries')
export const addGrowthContribution = body => request.post('/growth/manual', body)
