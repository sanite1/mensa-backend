import axios from 'axios'

export const sendboxClient = axios.create({
  baseURL: 'https://api.sendbox.co',
  headers: {
    Authorization: `Bearer ${process.env.SENDBOX_API_KEY}`,
    'Content-Type': 'application/json',
  },
})
