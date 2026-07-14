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
import {
  Check,
  Clipboard,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import {
  createRegistrationCodes,
  deleteInvalidRegistrationCodes,
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

const PAGE_SIZE = 10

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

function toTimestamp(value: string): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 0
  return Math.floor(time / 1000)
}

function getStatusKey(code: RegistrationCode): string {
  if (
    code.status === REGISTRATION_CODE_STATUS.ENABLED &&
    code.expired_time > 0 &&
    code.expired_time < Math.floor(Date.now() / 1000)
  ) {
    return 'Expired'
  }
  if (code.status === REGISTRATION_CODE_STATUS.ENABLED) return 'Enabled'
  if (code.status === REGISTRATION_CODE_STATUS.DISABLED) return 'Disabled'
  if (code.status === REGISTRATION_CODE_STATUS.USED) return 'Used'
  return 'Unknown'
}

function statusVariant(
  statusKey: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (statusKey === 'Enabled') return 'default'
  if (statusKey === 'Used') return 'secondary'
  if (statusKey === 'Disabled') return 'outline'
  return 'destructive'
}

export function RegistrationCodes() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<RegistrationCodeStatusFilter>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [expiresAt, setExpiresAt] = useState('')
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

  const queryKey = ['registration-codes', page, keyword, status]
  const listQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (keyword.trim() || status) {
        return searchRegistrationCodes({
          keyword: keyword.trim(),
          status,
          p: page,
          page_size: PAGE_SIZE,
        })
      }
      return getRegistrationCodes({ p: page, page_size: PAGE_SIZE })
    },
  })

  const codes = listQuery.data?.data?.items ?? []
  const total = listQuery.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const generatedText = useMemo(() => generatedCodes.join('\n'), [
    generatedCodes,
  ])

  const invalidateList = async () => {
    await queryClient.invalidateQueries({ queryKey: ['registration-codes'] })
  }

  const createMutation = useMutation({
    mutationFn: createRegistrationCodes,
    onSuccess: async (res) => {
      if (res.success) {
        const keys = res.data ?? []
        setGeneratedCodes(keys)
        setName('')
        setCount(1)
        setExpiresAt('')
        toast.success(
          t('Successfully created {{count}} registration codes', {
            count: keys.length,
          })
        )
        await invalidateList()
      } else {
        toast.error(res.message || t('Failed to create registration codes'))
      }
    },
  })

  const statusMutation = useMutation({
    mutationFn: (data: { id: number; status: number }) =>
      updateRegistrationCodeStatus(data.id, data.status),
    onSuccess: async (res) => {
      if (res.success) {
        toast.success(t('Registration code status updated'))
        await invalidateList()
      } else {
        toast.error(res.message || t('Failed to update registration code'))
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRegistrationCode,
    onSuccess: async (res) => {
      if (res.success) {
        toast.success(t('Registration code deleted'))
        await invalidateList()
      } else {
        toast.error(res.message || t('Failed to delete registration code'))
      }
    },
  })

  const deleteInvalidMutation = useMutation({
    mutationFn: deleteInvalidRegistrationCodes,
    onSuccess: async (res) => {
      if (res.success) {
        toast.success(
          t('Successfully deleted {{count}} invalid registration codes', {
            count: res.data ?? 0,
          })
        )
        await invalidateList()
      } else {
        toast.error(
          res.message || t('Failed to delete invalid registration codes')
        )
      }
    },
  })

  const handleCreate = () => {
    const cleanName = name.trim()
    if (!cleanName) {
      toast.error(t('Please enter a registration code name'))
      return
    }
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      toast.error(t('Registration code count must be between 1 and 100'))
      return
    }
    createMutation.mutate({
      name: cleanName,
      count,
      expired_time: toTimestamp(expiresAt),
    })
  }

  const handleCopy = async (value: string) => {
    const ok = await copyToClipboard(value)
    if (ok) toast.success(t('Copied to clipboard'))
    else toast.error(t('Failed to copy'))
  }

  const handleStatusChange = (code: RegistrationCode) => {
    const nextStatus =
      code.status === REGISTRATION_CODE_STATUS.ENABLED
        ? REGISTRATION_CODE_STATUS.DISABLED
        : REGISTRATION_CODE_STATUS.ENABLED
    statusMutation.mutate({ id: code.id, status: nextStatus })
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Registration Codes')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            className='gap-2'
            onClick={() => deleteInvalidMutation.mutate()}
            disabled={deleteInvalidMutation.isPending}
          >
            {deleteInvalidMutation.isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Trash2 className='h-4 w-4' />
            )}
            {t('Delete Invalid')}
          </Button>
          <Button className='gap-2' onClick={() => setCreateOpen(true)}>
            <Plus className='h-4 w-4' />
            {t('Generate Registration Codes')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <div className='relative flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value)
                    setPage(1)
                  }}
                  placeholder={t('Search registration codes')}
                  className='pl-9'
                />
              </div>
              <NativeSelect
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as RegistrationCodeStatusFilter)
                  setPage(1)
                }}
                className='w-full sm:w-44'
              >
                <NativeSelectOption value=''>
                  {t('All statuses')}
                </NativeSelectOption>
                <NativeSelectOption value='1'>{t('Enabled')}</NativeSelectOption>
                <NativeSelectOption value='2'>
                  {t('Disabled')}
                </NativeSelectOption>
                <NativeSelectOption value='3'>{t('Used')}</NativeSelectOption>
                <NativeSelectOption value='expired'>
                  {t('Expired')}
                </NativeSelectOption>
              </NativeSelect>
            </div>

            <div className='rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Name')}</TableHead>
                    <TableHead>{t('Registration Code')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Created At')}</TableHead>
                    <TableHead>{t('Expires At')}</TableHead>
                    <TableHead>{t('Used By')}</TableHead>
                    <TableHead className='text-right'>{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className='text-center'>
                        {t('Loading...')}
                      </TableCell>
                    </TableRow>
                  ) : codes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='text-muted-foreground text-center'
                      >
                        {t('No registration codes found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    codes.map((code) => {
                      const statusKey = getStatusKey(code)
                      const canToggle =
                        code.status !== REGISTRATION_CODE_STATUS.USED &&
                        statusKey !== 'Expired'
                      return (
                        <TableRow key={code.id}>
                          <TableCell>{code.name}</TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <code className='bg-muted rounded px-2 py-1 font-mono text-xs'>
                                {code.key}
                              </code>
                              <Button
                                type='button'
                                variant='ghost'
                                size='icon-sm'
                                onClick={() => handleCopy(code.key)}
                                title={t('Copy registration code')}
                              >
                                <Clipboard className='h-4 w-4' />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(statusKey)}>
                              {t(statusKey)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatTimestamp(code.created_time)}
                          </TableCell>
                          <TableCell>
                            {formatTimestamp(code.expired_time)}
                          </TableCell>
                          <TableCell>
                            {code.used_username ||
                              (code.used_user_id > 0
                                ? String(code.used_user_id)
                                : '-')}
                          </TableCell>
                          <TableCell>
                            <div className='flex justify-end gap-1'>
                              {canToggle && (
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='icon-sm'
                                  onClick={() => handleStatusChange(code)}
                                  title={
                                    code.status ===
                                    REGISTRATION_CODE_STATUS.ENABLED
                                      ? t('Disable registration code')
                                      : t('Enable registration code')
                                  }
                                  disabled={statusMutation.isPending}
                                >
                                  {code.status ===
                                  REGISTRATION_CODE_STATUS.ENABLED ? (
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
                                onClick={() => deleteMutation.mutate(code.id)}
                                title={t('Delete registration code')}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className='flex items-center justify-between gap-2'>
              <p className='text-muted-foreground text-sm'>
                {t('Total {{count}} registration codes', { count: total })}
              </p>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  {t('Previous')}
                </Button>
                <span className='text-muted-foreground text-sm'>
                  {t('Page {{page}} of {{total}}', {
                    page,
                    total: totalPages,
                  })}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  {t('Next')}
                </Button>
              </div>
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('Generate Registration Codes')}</DialogTitle>
            <DialogDescription>
              {t('Create one or more registration codes for new user signup.')}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label htmlFor='registration-code-name'>{t('Name')}</Label>
              <Input
                id='registration-code-name'
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('Internal batch name')}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='registration-code-count'>{t('Quantity')}</Label>
              <Input
                id='registration-code-count'
                type='number'
                min={1}
                max={100}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='registration-code-expiry'>
                {t('Expires At')}
              </Label>
              <Input
                id='registration-code-expiry'
                type='datetime-local'
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
              <p className='text-muted-foreground text-xs'>
                {t('Leave empty for codes that never expire.')}
              </p>
            </div>
            {generatedCodes.length > 0 && (
              <div className='grid gap-2'>
                <div className='flex items-center justify-between gap-2'>
                  <Label>{t('Generated Registration Codes')}</Label>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => handleCopy(generatedText)}
                  >
                    {t('Copy All')}
                  </Button>
                </div>
                <Textarea readOnly value={generatedText} rows={6} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setCreateOpen(false)}
            >
              {t('Close')}
            </Button>
            <Button
              type='button'
              className='gap-2'
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : null}
              {t('Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
