"use client";

import Image from "next/image";
import { CheckCircleIcon, ShieldCheckIcon, ClockIcon, UsersIcon, ScanFaceIcon, FileTextIcon, SmartphoneIcon, BrainCircuitIcon } from "lucide-react";

const teamMembers = [
  { name: "Sofi Novisa", nim: "C789202301.043" },
  { name: "Novi Julianti", nim: "C78920230.110" },
  { name: "Syamsiah Hidayati", nim: "C789202301053" },
  { name: "Sohibun Farojin", nim: "C789202301.102" },
  { name: "Iksan", nim: "C789202301.054" },
  { name: "Faisal Ahmad Bintang", nim: "C789202301.016" },
  { name: "Nur Azizah", nim: "C7432023001.008" },
  { name: "Baharudin", nim: "-" },
  { name: "Arafat Setiawan", nim: "C789202301.114" },
];

const benefits = [
  {
    icon: ScanFaceIcon,
    title: "Deteksi Wajah Otomatis",
    description: "Menggunakan teknologi AI Face Recognition untuk mendeteksi dan mengenali wajah siswa secara real-time tanpa kontak fisik.",
  },
  {
    icon: ClockIcon,
    title: "Pencatatan Keterlambatan Akurat",
    description: "Sistem mencatat waktu kedatangan siswa secara otomatis dan presisi, mengurangi risiko kesalahan pencatatan manual.",
  },
  {
    icon: FileTextIcon,
    title: "Laporan PDF Otomatis",
    description: "Generate laporan keterlambatan harian, bulanan, dan per-kelas dalam format PDF yang rapi dan siap cetak.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Data Aman & Terenkripsi",
    description: "Seluruh data siswa dan embedding wajah disimpan secara aman di database dengan autentikasi berlapis.",
  },
  {
    icon: SmartphoneIcon,
    title: "Responsive & Mobile-Friendly",
    description: "Antarmuka yang responsif dan dapat diakses dari berbagai perangkat, baik komputer, tablet, maupun smartphone.",
  },
  {
    icon: BrainCircuitIcon,
    title: "Teknologi AI Modern",
    description: "Dibangun dengan InsightFace (buffalo_l) dan pgvector untuk pencarian kemiripan wajah yang cepat dan akurat.",
  },
];

export default function AboutPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12 pb-16 max-w-4xl mx-auto">

      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          Tentang FaceLate AI
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Sistem Absensi Keterlambatan Siswa Berbasis Face Recognition — Karya Mahasiswa KKN STKIP YAPIS Dompu di SMP Negeri 1 Dompu.
        </p>
      </div>

      {/* Logos */}
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 py-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 md:w-28 md:h-28 relative rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 p-2">
            <Image src="/LOGO/LOGOSTKIP.png" alt="Logo STKIP YAPIS Dompu" fill className="object-contain p-1" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center">STKIP YAPIS<br/>Dompu</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 md:w-28 md:h-28 relative rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 p-2">
            <Image src="/LOGO/LOGOKKN.png" alt="Logo KKN" fill className="object-contain p-1" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center">KKN<br/>STKIP YAPIS</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 md:w-28 md:h-28 relative rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 p-2">
            <Image src="/LOGO/LOGOSMP1DOMPU.png" alt="Logo SMP Negeri 1 Dompu" fill className="object-contain p-1" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center">SMP Negeri 1<br/>Dompu</span>
        </div>
      </div>

      {/* Deskripsi Aplikasi */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8 space-y-4">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Apa itu FaceLate AI?</h3>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
          <strong>FaceLate AI</strong> adalah aplikasi web inovatif yang dirancang untuk membantu pihak sekolah dalam memantau dan mencatat keterlambatan siswa secara otomatis menggunakan teknologi <em>Artificial Intelligence (AI) Face Recognition</em>. 
        </p>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
          Dengan aplikasi ini, guru piket cukup mengarahkan kamera ke wajah siswa yang terlambat, dan sistem akan secara otomatis mengenali identitas siswa serta mencatat data keterlambatannya ke dalam database. Seluruh proses berlangsung cepat, akurat, dan tanpa memerlukan input manual yang memakan waktu.
        </p>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
          Aplikasi ini dibangun sebagai salah satu program kerja <strong>Kuliah Kerja Nyata (KKN)</strong> mahasiswa STKIP YAPIS Dompu yang ditempatkan di SMP Negeri 1 Dompu, dengan tujuan menghadirkan solusi teknologi tepat guna untuk permasalahan administrasi sekolah.
        </p>
      </div>

      {/* Manfaat Aplikasi */}
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Manfaat Aplikasi</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Keunggulan yang ditawarkan FaceLate AI untuk sekolah Anda.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4">
                <benefit.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">{benefit.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tim KKN */}
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Tim Pengembang</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Mahasiswa KKN STKIP YAPIS Dompu — SMP Negeri 1 Dompu</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Lengkap</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">NIM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {teamMembers.map((member, index) => (
                <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-medium">{index + 1}</td>
                  <td className="px-5 py-4 text-slate-800 dark:text-white font-medium">{member.name}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{member.nim}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote / Closing */}
      <div className="text-center py-6 space-y-3">
        <p className="text-slate-400 dark:text-slate-500 text-sm italic">
          &ldquo;Teknologi yang tepat guna adalah teknologi yang menjawab kebutuhan nyata masyarakat.&rdquo;
        </p>
        <p className="text-slate-500 dark:text-slate-400 text-xs">
          &copy; {new Date().getFullYear()} KKN STKIP YAPIS Dompu &mdash; SMP Negeri 1 Dompu
        </p>
      </div>
    </div>
  );
}
