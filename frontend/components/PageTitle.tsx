interface PageTitleProps {
  title: string
  subtitle?: string
  description?: string
}

export default function PageTitle({ title, subtitle, description }: PageTitleProps) {
  return (
    <div className="text-center py-20">
      <h1 className="text-5xl font-bold mb-6 text-gray-900 dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
          {subtitle}
        </p>
      )}
      {description && (
        <p className="text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  )
}
