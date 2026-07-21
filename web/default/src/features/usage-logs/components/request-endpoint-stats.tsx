/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatLogQuota, formatTokens, formatUseTime } from '@/lib/format'

import { getRequestEndpointStats } from '../api'
import { getDefaultTimeRange } from '../lib/utils'
import type { RequestEndpointStats } from '../types'
import { CompactDateTimeRangePicker } from './compact-date-time-range-picker'
import { useLogsViewScope } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

const EMPTY_STATS: RequestEndpointStats = {
  items: [],
  requests: 0,
  success: 0,
  failed: 0,
  total_tokens: 0,
  quota: 0,
  average_response_time: 0,
}

const SKELETON_ROWS = ['messages', 'responses', 'chat-completions'] as const
const SKELETON_CELLS = [
  'endpoint',
  'requests',
  'success',
  'failed',
  'share',
  'tokens',
  'cost',
  'response-time',
] as const

function SummaryMetric(props: { label: string; value: string | number }) {
  return (
    <div className='flex min-w-[140px] flex-col gap-1 border-l-2 border-l-sky-500/70 pl-3'>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span className='font-mono text-lg font-semibold tabular-nums'>
        {props.value}
      </span>
    </div>
  )
}

export function RequestEndpointStatsView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const searchParams = route.useSearch()
  const { isAdminView: isAdmin } = useLogsViewScope()
  const defaultRange = useMemo(() => getDefaultTimeRange(), [])
  const start = searchParams.startTime
    ? new Date(searchParams.startTime)
    : defaultRange.start
  const end = searchParams.endTime
    ? new Date(searchParams.endTime)
    : defaultRange.end

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      'request-endpoint-stats',
      isAdmin,
      start.getTime(),
      end.getTime(),
    ],
    queryFn: async () => {
      const result = await getRequestEndpointStats(
        {
          start_timestamp: Math.floor(start.getTime() / 1000),
          end_timestamp: Math.floor(end.getTime() / 1000),
        },
        isAdmin
      )
      if (!result.success) {
        toast.error(result.message || t('Failed to load request statistics'))
        return EMPTY_STATS
      }
      return result.data || EMPTY_STATS
    },
    placeholderData: (previousData) => previousData,
  })

  const stats = data || EMPTY_STATS

  const handleRangeChange = (range: { start?: Date; end?: Date }) => {
    void navigate({
      to: '/usage-logs/$section',
      params: { section: 'request-stats' },
      search: {
        startTime: range.start?.getTime(),
        endTime: range.end?.getTime(),
      },
    })
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-5'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <CompactDateTimeRangePicker
          start={start}
          end={end}
          onChange={handleRangeChange}
          className='sm:w-auto'
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
          {t('Refresh')}
        </Button>
      </div>

      <div className='grid grid-cols-2 gap-4 border-y py-4 lg:grid-cols-5'>
        <SummaryMetric label={t('Total Requests')} value={stats.requests} />
        <SummaryMetric label={t('Success')} value={stats.success} />
        <SummaryMetric label={t('Failed')} value={stats.failed} />
        <SummaryMetric
          label={t('Total Tokens')}
          value={formatTokens(stats.total_tokens)}
        />
        <SummaryMetric
          label={t('Total Cost')}
          value={formatLogQuota(stats.quota)}
        />
      </div>

      <div className='min-h-0 overflow-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Endpoint')}</TableHead>
              <TableHead className='text-right'>{t('Requests')}</TableHead>
              <TableHead className='text-right'>{t('Success')}</TableHead>
              <TableHead className='text-right'>{t('Failed')}</TableHead>
              <TableHead className='text-right'>{t('Share')}</TableHead>
              <TableHead className='text-right'>{t('Total Tokens')}</TableHead>
              <TableHead className='text-right'>{t('Total Cost')}</TableHead>
              <TableHead className='text-right'>
                {t('Average Response Time')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? SKELETON_ROWS.map((rowKey) => (
                  <TableRow key={rowKey}>
                    {SKELETON_CELLS.map((cellKey) => (
                      <TableCell key={cellKey}>
                        <Skeleton className='h-5 w-full' />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : stats.items.map((item) => {
                  const share =
                    stats.requests > 0
                      ? `${((item.requests / stats.requests) * 100).toFixed(1)}%`
                      : '0%'
                  return (
                    <TableRow key={item.path}>
                      <TableCell>
                        <code className='font-mono text-xs'>{item.path}</code>
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {item.requests.toLocaleString()}
                      </TableCell>
                      <TableCell className='text-right font-mono text-emerald-600 tabular-nums dark:text-emerald-400'>
                        {item.success.toLocaleString()}
                      </TableCell>
                      <TableCell className='text-destructive text-right font-mono tabular-nums'>
                        {item.failed.toLocaleString()}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {share}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatTokens(item.total_tokens)}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatLogQuota(item.quota)}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {formatUseTime(item.average_response_time)}
                      </TableCell>
                    </TableRow>
                  )
                })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
