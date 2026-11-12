export function createRecordListLoader(fetchList, { records, loading, error }) {
  let generation = 0
  return async function fetchRecords(params) {
    const request = ++generation
    loading.value = true
    error.value = null
    try {
      const response = await fetchList(params)
      if (request === generation) records.value = response.data || []
    } catch (cause) {
      if (request === generation) error.value = cause.message || '获取记录失败'
    } finally {
      if (request === generation) loading.value = false
    }
  }
}
