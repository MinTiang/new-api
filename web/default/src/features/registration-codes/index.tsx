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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
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
import { Textarea } from '@/components/ui/textarea'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import { createRegistrationCodes, deleteInvalidRegistrationCodes } from './api'
import { RegistrationCodesTable } from './registration-codes-table'

function toTimestamp(value: string): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 0
  return Math.floor(time / 1000)
}

export function RegistrationCodes() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [expiresAt, setExpiresAt] = useState('')
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

  const generatedText = useMemo(
    () => generatedCodes.join('\n'),
    [generatedCodes]
  )

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
          <RegistrationCodesTable />
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
