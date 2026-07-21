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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { Check, Trash2, X } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { MaskedValueDisplay } from '@/components/masked-value-display'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { formatTimestampToDate } from '@/lib/format'

import {
  deleteRegistrationCode,
  getRegistrationCodes,
  searchRegistrationCodes,
  updateRegistrationCodeStatus,
} from './api'
import {
  REGISTRATION_CODE_STATUS,
  type RegistrationCode,
  type RegistrationCodeStatusFilter,
} from './types'

const route = getRouteApi('/_authenticated/registration-codes/')

function isExpired(code: RegistrationCode): boolean {
  return (
    code.status === REGISTRATION_CODE_STATUS.ENABLED &&
    code.expired_time > 0 &&
    code.expired_time < Math.floor(Date.now() / 1000)
  )
}

function getStatusConfig(code: RegistrationCode): {
  label: string
  variant: StatusVariant
} {
  if (isExpired(code)) return { label: 'Expired', variant: 'warning' }
  if (code.status === REGISTRATION_CODE_STATUS.ENABLED) {
    return { label: 'Enabled', variant: 'success' }
  }
  if (code.status === REGISTRATION_CODE_STATUS.DISABLED) {
    return { label: 'Disabled', variant: 'neutral' }
  }
  if (code.status === REGISTRATION_CODE_STATUS.USED) {
    return { label: 'Used', variant: 'neutral' }
  }
  return { label: 'Unknown', variant: 'neutral' }
}

function buildColumns(options: {
  t: TFunction
  onToggle: (code: RegistrationCode) => void
  onDelete: (id: number) => void
  statusPending: boolean
  deletePending: boolean
}): ColumnDef<RegistrationCode>[] {
  const { t, onToggle, onDelete, statusPending, deletePending } = options

  return [
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => <TableId value={row.original.id} />,
      size: 80,
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.name}</span>
      ),
      size: 180,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const status = getStatusConfig(row.original)
        return (
          <StatusBadge
            label={t(status.label)}
            variant={status.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 120,
    },
    {
      accessorKey: 'key',
      header: t('Registration Code'),
      cell: ({ row }) => {
        const key = row.original.key
        const maskedKey =
          key.length > 16
            ? `${key.slice(0, 8)}******${key.slice(-8)}`
            : '*'.repeat(key.length)
        return (
          <MaskedValueDisplay
            label={t('Registration Code')}
            fullValue={key}
            maskedValue={maskedKey}
            copyTooltip={t('Copy registration code')}
            copyAriaLabel={t('Copy registration code')}
          />
        )
      },
      enableSorting: false,
      size: 300,
    },
    {
      accessorKey: 'created_time',
      header: t('Created At'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <div className='min-w-[160px] font-mono text-sm'>
          {formatTimestampToDate(row.original.created_time)}
        </div>
      ),
      size: 180,
    },
    {
      accessorKey: 'expired_time',
      header: t('Expires At'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const code = row.original
        if (!code.expired_time) {
          return (
            <StatusBadge
              label={t('Never')}
              variant='neutral'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }
        return (
          <div
            className={`min-w-[160px] font-mono text-sm ${isExpired(code) ? 'text-destructive' : ''}`}
          >
            {formatTimestampToDate(code.expired_time)}
          </div>
        )
      },
      size: 180,
    },
    {
      accessorKey: 'used_user_id',
      header: t('Used By'),
      cell: ({ row }) => {
        const code = row.original
        const value =
          code.used_username ||
          (code.used_user_id > 0 ? String(code.used_user_id) : '-')
        return <span className='text-sm'>{value}</span>
      },
      size: 140,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => {
        const code = row.original
        const status = getStatusConfig(code)
        const canToggle =
          code.status !== REGISTRATION_CODE_STATUS.USED &&
          status.label !== 'Expired'

        return (
          <div className='flex justify-end gap-1'>
            {canToggle && (
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={() => onToggle(code)}
                title={
                  code.status === REGISTRATION_CODE_STATUS.ENABLED
                    ? t('Disable registration code')
                    : t('Enable registration code')
                }
                disabled={statusPending}
              >
                {code.status === REGISTRATION_CODE_STATUS.ENABLED ? (
                  <X className='h-4 w-4' />
                ) : (
                  <Check className='h-4 w-4' />
                )}
              </Button>
            )}
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              onClick={() => onDelete(code.id)}
              title={t('Delete registration code')}
              disabled={deletePending}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        )
      },
      meta: { pinned: 'right' as const },
      size: 96,
    },
  ]
}

export function RegistrationCodesTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusFilterValue =
    (statusFilter[0] as RegistrationCodeStatusFilter | undefined) ?? ''

  const listQuery = useQuery({
    queryKey: [
      'registration-codes',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilterValue,
    ],
    queryFn: async () => {
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }
      const hasFilter = Boolean(globalFilter?.trim())
      const hasStatusFilter = statusFilterValue !== ''
      const result =
        hasFilter || hasStatusFilter
          ? await searchRegistrationCodes({
              ...params,
              keyword: globalFilter,
              status: statusFilterValue,
            })
          : await getRegistrationCodes(params)

      return {
        items: result.success ? (result.data?.items ?? []) : [],
        total: result.success ? (result.data?.total ?? 0) : 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const invalidateList = async () => {
    await queryClient.invalidateQueries({ queryKey: ['registration-codes'] })
  }

  const { mutate: mutateStatus, isPending: statusPending } = useMutation({
    mutationFn: (data: { id: number; status: number }) =>
      updateRegistrationCodeStatus(data.id, data.status),
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to update registration code'))
        return
      }
      toast.success(t('Registration code status updated'))
      await invalidateList()
    },
  })

  const { mutate: mutateDelete, isPending: deletePending } = useMutation({
    mutationFn: deleteRegistrationCode,
    onSuccess: async (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to delete registration code'))
        return
      }
      toast.success(t('Registration code deleted'))
      await invalidateList()
    },
  })

  const handleToggle = useCallback(
    (code: RegistrationCode) => {
      const nextStatus =
        code.status === REGISTRATION_CODE_STATUS.ENABLED
          ? REGISTRATION_CODE_STATUS.DISABLED
          : REGISTRATION_CODE_STATUS.ENABLED
      mutateStatus({ id: code.id, status: nextStatus })
    },
    [mutateStatus]
  )

  const handleDelete = useCallback(
    (id: number) => mutateDelete(id),
    [mutateDelete]
  )

  const columns = useMemo(
    () =>
      buildColumns({
        t,
        onToggle: handleToggle,
        onDelete: handleDelete,
        statusPending,
        deletePending,
      }),
    [t, handleToggle, handleDelete, statusPending, deletePending]
  )

  const { table } = useDataTable({
    data: listQuery.data?.items ?? [],
    columns,
    columnFilters,
    globalFilter,
    pagination,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: listQuery.data?.total ?? 0,
    ensurePageInRange,
  })

  const statusOptions = useMemo(
    () => [
      { label: t('Enabled'), value: '1' },
      { label: t('Disabled'), value: '2' },
      { label: t('Used'), value: '3' },
      { label: t('Expired'), value: 'expired' },
    ],
    [t]
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={listQuery.isLoading}
      isFetching={listQuery.isFetching}
      emptyTitle={t('No registration codes found')}
      emptyDescription={t(
        'Create one or more registration codes for new user signup.'
      )}
      skeletonKeyPrefix='registration-codes-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Search registration codes'),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, { isMobile }) => {
        if (
          row.original.status === REGISTRATION_CODE_STATUS.ENABLED &&
          !isExpired(row.original)
        ) {
          return undefined
        }
        return isMobile ? DISABLED_ROW_MOBILE : DISABLED_ROW_DESKTOP
      }}
    />
  )
}
