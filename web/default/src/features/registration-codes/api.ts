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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  RegistrationCode,
  RegistrationCodeFormData,
  RegistrationCodeListResponse,
  RegistrationCodeStatusFilter,
} from './types'

type ListParams = {
  p?: number
  page_size?: number
}

type SearchParams = ListParams & {
  keyword?: string
  status?: RegistrationCodeStatusFilter
}

export async function getRegistrationCodes(
  params: ListParams = {}
): Promise<RegistrationCodeListResponse> {
  const p = params.p ?? 1
  const pageSize = params.page_size ?? 10
  const res = await api.get(
    `/api/registration-code/?p=${p}&page_size=${pageSize}`
  )
  return res.data
}

export async function searchRegistrationCodes(
  params: SearchParams
): Promise<RegistrationCodeListResponse> {
  const queryParams = new URLSearchParams()
  queryParams.set('keyword', params.keyword ?? '')
  if (params.status) queryParams.set('status', params.status)
  queryParams.set('p', String(params.p ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  const res = await api.get(
    `/api/registration-code/search?${queryParams.toString()}`
  )
  return res.data
}

export async function createRegistrationCodes(
  data: RegistrationCodeFormData
): Promise<ApiResponse<string[]>> {
  const res = await api.post('/api/registration-code/', data, {
    skipBusinessError: true,
  })
  return res.data
}

export async function updateRegistrationCode(
  data: RegistrationCodeFormData & { id: number }
): Promise<ApiResponse<RegistrationCode>> {
  const res = await api.put('/api/registration-code/', data, {
    skipBusinessError: true,
  })
  return res.data
}

export async function updateRegistrationCodeStatus(
  id: number,
  status: number
): Promise<ApiResponse<RegistrationCode>> {
  const res = await api.put(
    '/api/registration-code/?status_only=true',
    {
      id,
      status,
    },
    {
      skipBusinessError: true,
    }
  )
  return res.data
}

export async function deleteRegistrationCode(
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/registration-code/${id}`, {
    skipBusinessError: true,
  })
  return res.data
}

export async function deleteInvalidRegistrationCodes(): Promise<
  ApiResponse<number>
> {
  const res = await api.delete('/api/registration-code/invalid', {
    skipBusinessError: true,
  })
  return res.data
}
