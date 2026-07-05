export const documentRequirementsSeed = [
  { key: 'student_request', label: 'Formulario de solicitud del estudiante', required: true, allowed_file_types: JSON.stringify(['pdf']), max_file_size_mb: 5, requires_approval: true },
  { key: 'work_plan', label: 'Plan de trabajo', required: true, allowed_file_types: JSON.stringify(['pdf', 'docx']), max_file_size_mb: 10, requires_approval: true },
  { key: 'acceptance_letter', label: 'Carta de aceptación del proyecto', required: true, allowed_file_types: JSON.stringify(['pdf']), requires_approval: true },
  { key: 'final_report', label: 'Informe final', required: true, allowed_file_types: JSON.stringify(['pdf']), max_file_size_mb: 20, requires_approval: true },
  { key: 'supervisor_evaluation', label: 'Evaluación del supervisor', required: true, allowed_file_types: JSON.stringify(['pdf']), requires_approval: true },
];
