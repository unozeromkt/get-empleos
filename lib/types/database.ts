export type Role = "admin" | "candidate" | "company";

export type JobStatus = "draft" | "pending_review" | "active" | "paused" | "closed";
export type JobModality = "presencial" | "remoto" | "hibrido";
export type ContractType = "tiempo_completo" | "tiempo_parcial" | "temporal" | "por_obra";
export type EducationLevel =
  | "bachiller"
  | "tecnico"
  | "tecnologo"
  | "profesional"
  | "especialista"
  | "maestria"
  | "doctorado";
export type Gender = "masculino" | "femenino" | "otro" | "prefiero_no_decir";
export type Availability = "inmediata" | "15_dias" | "30_dias";
export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "shortlisted"
  | "rejected"
  | "hired";
export type CompanyStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  role: Role;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  birth_date: string | null;
  gender: Gender | null;
  education_level: EducationLevel | null;
  career: string | null;
  years_experience: number;
  skills: string[];
  languages: string[];
  linkedin_url: string | null;
  cv_url: string | null;
  cv_updated_at: string | null;
  availability: Availability | null;
  expected_salary: number | null;
  summary: string | null;
  profile_complete: boolean;
}

export interface CandidateWithProfile extends Candidate {
  profile: Profile;
}

export interface JobArea {
  id: number;
  name: string;
  icon: string;
  slug: string;
}

export interface Job {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements: string | null;
  benefits: string | null;
  area_id: number | null;
  modality: JobModality | null;
  contract_type: ContractType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_visible: boolean;
  city: string;
  department: string | null;
  vacancies: number;
  status: JobStatus;
  featured: boolean;
  company_id: string | null;
  created_by: string | null;
  review_notes: string | null;
  expires_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  nit: string | null;
  legal_rep: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  city: string | null;
  industry: string | null;
  status: CompanyStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithProfile extends Company {
  profile: Profile;
}

export interface JobWithArea extends Job {
  area: JobArea | null;
}

export interface JobWithCompany extends JobWithArea {
  company: Company | null;
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  admin_notes: string | null;
  applied_at: string;
  updated_at: string;
}

export interface ApplicationWithDetails extends Application {
  job: JobWithCompany;
  candidate: CandidateWithProfile;
}
