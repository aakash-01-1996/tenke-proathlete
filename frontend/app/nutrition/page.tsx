'use client'

import { useState, useEffect } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { app } from '@/lib/firebase'

type NutritionMeal = {
  id: string
  meal_order: number
  label: string
  food_items: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string | null
}

type NutritionPlan = {
  id: string
  daily_calories: number | null
  daily_protein_g: number | null
  daily_carbs_g: number | null
  daily_fat_g: number | null
  summary_notes: string | null
  meals: NutritionMeal[]
}

export default function NutritionPage() {
  const [plan, setPlan] = useState<NutritionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(app), async (user) => {
      if (!user) { setLoading(false); return }
      try {
        const token = await user.getIdToken()
        const headers = { Authorization: `Bearer ${token}` }
        const meRes = await fetch(`${API}/auth/me`, { headers })
        if (!meRes.ok) { setLoading(false); return }
        const me = await meRes.json()
        const memberId = me.role === 'member' ? me.ref_id : null
        if (!memberId) { setLoading(false); return }
        const planRes = await fetch(`${API}/nutrition/${memberId}/plan`, { headers })
        if (planRes.ok) setPlan(await planRes.json())
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const resources = [
    {
      id: '1',
      title: 'Athlete Meal Plan - Week 1',
      description: 'A complete weekly meal plan designed for high-performance training days and recovery.',
      category: 'Meal Plan',
      date: 'Apr 8, 2026',
    },
    {
      id: '2',
      title: 'Top 10 Foods for Muscle Recovery',
      description: 'A guide on the best foods to consume post-workout to maximize recovery and growth.',
      category: 'Guide',
      date: 'Apr 5, 2026',
    },
    {
      id: '3',
      title: 'Understanding Macronutrients',
      description: 'Learn how protein, carbohydrates, and fats each play a vital role in athletic performance.',
      category: 'Education',
      date: 'Mar 30, 2026',
    },
    {
      id: '4',
      title: 'Pre-Workout Nutrition Checklist',
      description: 'What to eat and when to eat it before training to maximize your energy and output.',
      category: 'Checklist',
      date: 'Mar 22, 2026',
    },
  ]

  const categoryColors: { [key: string]: string } = {
    'Meal Plan': 'bg-green-100 text-green-700',
    'Guide': 'bg-blue-100 text-blue-700',
    'Education': 'bg-purple-100 text-purple-700',
    'Checklist': 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-5xl px-6" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>

        {/* Intro Text */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Nutrition</h1>
          <p className="text-gray-600 leading-relaxed">
            Proper nutrition is the foundation of every great athletic performance — what you eat directly fuels how you train, recover, and grow.
            Without the right balance of nutrients, even the hardest training sessions will fall short of their potential.
            Use the resources below to build healthy habits, optimize your diet, and stay on track with your goals.
          </p>
        </div>

        {/* Active plan */}
        {!loading && plan && (
          <div style={{ marginBottom: '2.5rem' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Your Active Plan</p>
            <div className="bg-white rounded-2xl border border-gray-200" style={{ padding: '1.5rem' }}>
              {(plan.daily_calories || plan.daily_protein_g || plan.daily_carbs_g || plan.daily_fat_g) && (
                <div className="flex gap-6 mb-4">
                  {plan.daily_calories != null && <div><p className="text-xs text-gray-400 mb-0.5">Calories</p><p className="text-sm font-semibold text-gray-800">{plan.daily_calories} kcal</p></div>}
                  {plan.daily_protein_g != null && <div><p className="text-xs text-gray-400 mb-0.5">Protein</p><p className="text-sm font-semibold text-gray-800">{plan.daily_protein_g}g</p></div>}
                  {plan.daily_carbs_g != null && <div><p className="text-xs text-gray-400 mb-0.5">Carbs</p><p className="text-sm font-semibold text-gray-800">{plan.daily_carbs_g}g</p></div>}
                  {plan.daily_fat_g != null && <div><p className="text-xs text-gray-400 mb-0.5">Fat</p><p className="text-sm font-semibold text-gray-800">{plan.daily_fat_g}g</p></div>}
                </div>
              )}
              {plan.summary_notes && (
                <p className="text-sm text-gray-600 mb-4">{plan.summary_notes}</p>
              )}
              <div className="flex flex-col gap-2">
                {plan.meals.map((meal) => (
                  <div key={meal.id} className="bg-gray-50 rounded-xl" style={{ padding: '0.75rem 1rem' }}>
                    <p className="text-sm font-semibold text-gray-800 mb-1">{meal.label}</p>
                    {meal.food_items && <p className="text-xs text-gray-500">{meal.food_items}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        <hr className="border-gray-300" style={{ marginBottom: '2.5rem' }} />

        {/* PDF Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {resources.map((resource) => (
            <div key={resource.id} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                {/* PDF Icon */}
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                {/* Category Badge */}
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${categoryColors[resource.category]}`}>
                  {resource.category}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="font-semibold text-gray-900 text-base mb-1">{resource.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{resource.description}</p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-400">{resource.date}</span>
                <button className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
